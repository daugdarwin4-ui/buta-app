"""
Merge the downloaded datasets into one YOLO dataset with GuideAI's class list.

Run from model/datasets with the training venv:
    ../train-venv/Scripts/python.exe build_dataset.py

What it does
  1. Reads every source (boxes, outlines/polygons, or stair lines) and converts it to boxes.
  2. Renames each source's classes to the unified list below (the labels the app announces).
  3. Drops classes that must NOT be learned (closed manholes, "footpath" regions, generic blobs).
  4. Caps big sources so no dataset drowns the others, and shrinks images to speed up training.
  5. Writes merged/{images,labels}/{train,val,test} and merged/data.yaml.
Pseudo-labels for everyday objects (people, cars...) are added afterwards by pseudo_label.py.
"""
import glob
import json
import os
import random
import sys
from collections import Counter
from multiprocessing import Pool

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'merged')
MAX_SIDE = 416  # training runs at 320; a little extra keeps small objects sharp for augmentation
SEED = 42

# Unified classes. Labels must match mobile/src/constants/hazards.ts exactly (spaces included).
CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'tricycle', 'jeepney', 'bus', 'truck', 'dog', 'cat',
    'cow', 'horse', 'pothole', 'open_drainage', 'stairs', 'pole', 'barrier', 'bump',
    'cart', 'bench', 'chair', 'fire hydrant', 'potted plant', 'traffic light', 'stop sign',
]
CID = {name: i for i, name in enumerate(CLASSES)}

# source class name -> unified class (None = drop that label, the image is kept as a negative)
# Bangladeshi pedal rickshaws look nothing like Philippine tricycles; leaving them unlabeled would
# teach "background", so images containing them are left out entirely.
SKIP_IMAGE = 'SKIP_IMAGE'
VIP_NAV = ['Bin', 'Building Pillar', 'Bus', 'CNG', 'Car', 'Cycle', 'Electric Pole', 'Food Van', 'Food cart',
           'Footpath', 'Leguna', 'Motorcycle', 'Obstacle', 'Parking Cone', 'Person', 'Pickup', 'Rickshaw',
           'Stairs', 'Tree', 'Truck', 'Van', 'Van gari']
VIP_NAV_MAP = {
    'Bin': None, 'Building Pillar': 'pole', 'Bus': 'bus', 'CNG': 'tricycle', 'Car': 'car', 'Cycle': 'bicycle',
    'Electric Pole': 'pole', 'Food Van': 'cart', 'Food cart': 'cart', 'Footpath': None, 'Leguna': 'jeepney',
    'Motorcycle': 'motorcycle', 'Obstacle': 'barrier', 'Parking Cone': 'barrier', 'Person': 'person',
    'Pickup': 'car', 'Rickshaw': SKIP_IMAGE, 'Stairs': 'stairs', 'Tree': None, 'Truck': 'truck', 'Van': 'car',
    'Van gari': 'cart',
}

# (source folder, class names in file order, mapping, cap for train images or None)
SOURCES = {
    'ph_vehicles': (['bus', 'car', 'jeepney', 'motorcycles', 'tricycles', 'truck', 'van'],
                    {'bus': 'bus', 'car': 'car', 'jeepney': 'jeepney', 'motorcycles': 'motorcycle',
                     'tricycles': 'tricycle', 'truck': 'truck', 'van': 'car'}, 3500),
    'ph_tricycle_niluto': (['Car', 'Motorcycle', 'Tricycle'],
                           {'Car': 'car', 'Motorcycle': 'motorcycle', 'Tricycle': 'tricycle'}, None),
    'open_manhole': (['Manhole', 'Open Manhole', 'Pothole'],
                     {'Manhole': None, 'Open Manhole': 'open_drainage', 'Pothole': 'pothole'}, 2500),
    'pothole_ivcnz': (['pothole'], {'pothole': 'pothole'}, None),
    'stairs_rf1': (['object', 'stairs'], {'object': None, 'stairs': 'stairs'}, 2000),
    'stairs_rf2': (['stairs'], {'stairs': 'stairs'}, None),
    'stairs_lines': (['stairs', 'stairs'], {'stairs': 'stairs'}, 2000),
    'vip_navigation_bd': (VIP_NAV, VIP_NAV_MAP, 4500),
    'vip_obstacles': (['bump', 'fence', 'hole', 'pole'],
                      {'bump': 'bump', 'fence': 'barrier', 'hole': 'pothole', 'pole': 'pole'}, None),
}
EVAL_CAP = 250  # val/test images kept per source
# When a big source is capped, images with these (scarcer) classes are kept first
RARE = {'jeepney', 'bus', 'bicycle', 'bump', 'barrier', 'pole', 'truck', 'cart', 'tricycle'}


def find_images(src_dir):
    out = []
    for ext in ('jpg', 'jpeg', 'png'):
        out += glob.glob(os.path.join(src_dir, '**', '*.' + ext), recursive=True)
    return sorted(out)


def label_path_for(img):
    norm = img.replace('\\', '/')
    if '/images/' in norm:
        lp = norm.replace('/images/', '/labels/')
    else:
        lp = norm
    return os.path.splitext(lp)[0] + '.txt'


def scan(name, img):
    """-> (set of unified classes in the image, True if the image must be skipped)"""
    names, mapping, _ = SOURCES[name]
    found, skip = set(), False
    lf = label_path_for(img)
    if name == 'stairs_lines' or not os.path.exists(lf):
        return found, skip
    for line in open(lf, encoding='utf-8', errors='ignore'):
        p = line.split()
        if not p:
            continue
        try:
            cls = int(p[0])
        except ValueError:
            continue
        target = mapping.get(names[cls]) if 0 <= cls < len(names) else None
        if target == SKIP_IMAGE:
            skip = True
        elif target:
            found.add(target)
    return found, skip


def split_of(img, rng):
    parts = img.replace('\\', '/').lower().split('/')
    if 'train' in parts:
        return 'train'
    if 'valid' in parts or 'val' in parts:
        return 'val'
    if 'test' in parts:
        return 'test'
    r = rng.random()  # source without splits (pothole_ivcnz)
    return 'train' if r < 0.85 else ('val' if r < 0.925 else 'test')


def read_boxes(name, names, label_file, img_w, img_h):
    """-> list of (source_class_index, x1, y1, x2, y2) normalized 0-1"""
    if not os.path.exists(label_file):
        return []
    rows = [l.split() for l in open(label_file, encoding='utf-8', errors='ignore') if l.strip()]
    boxes = []
    if name == 'stairs_lines':
        # "cls x1 y1 x2 y2": endpoints of each step edge, in pixels. One box around all of them.
        xs, ys = [], []
        for r in rows:
            x1, y1, x2, y2 = (float(v) for v in r[1:5])
            xs += [x1, x2]
            ys += [y1, y2]
        if xs and max(xs) > min(xs) and max(ys) > min(ys):
            boxes.append((0, min(xs) / img_w, min(ys) / img_h, max(xs) / img_w, max(ys) / img_h))
        return boxes
    for r in rows:
        try:
            cls = int(r[0])
            vals = [float(v) for v in r[1:]]
        except ValueError:
            continue
        if len(vals) == 4:  # cx cy w h
            cx, cy, w, h = vals
            boxes.append((cls, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
        elif len(vals) >= 6 and len(vals) % 2 == 0:  # polygon outline -> its bounding box
            xs, ys = vals[0::2], vals[1::2]
            boxes.append((cls, min(xs), min(ys), max(xs), max(ys)))
    return boxes


def process(job):
    name, img, split, out_name = job
    names, mapping, _ = SOURCES[name]
    try:
        im = Image.open(img).convert('RGB')
    except Exception:
        return None
    w, h = im.size
    lines = []
    for cls, x1, y1, x2, y2 in read_boxes(name, names, label_path_for(img), w, h):
        if not 0 <= cls < len(names):
            continue
        target = mapping.get(names[cls])
        if target is None or target == SKIP_IMAGE:
            continue
        x1, y1, x2, y2 = (min(1, max(0, v)) for v in (x1, y1, x2, y2))
        bw, bh = x2 - x1, y2 - y1
        if bw < 0.01 or bh < 0.01:  # smaller than ~3 px at 320: not learnable, and noisy
            continue
        lines.append(f'{CID[target]} {(x1 + x2) / 2:.5f} {(y1 + y2) / 2:.5f} {bw:.5f} {bh:.5f}')
    scale = MAX_SIDE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
    im.save(os.path.join(OUT, 'images', split, out_name + '.jpg'), quality=90)
    with open(os.path.join(OUT, 'labels', split, out_name + '.txt'), 'w') as f:
        f.write('\n'.join(lines) + ('\n' if lines else ''))
    return split, name, [l.split()[0] for l in lines]


def main():
    rng = random.Random(SEED)
    for s in ('train', 'val', 'test'):
        os.makedirs(os.path.join(OUT, 'images', s), exist_ok=True)
        os.makedirs(os.path.join(OUT, 'labels', s), exist_ok=True)

    jobs = []
    for name, (_, _, cap) in SOURCES.items():
        imgs = find_images(os.path.join(SRC, name))
        by_split = {'train': [], 'val': [], 'test': []}
        has_rare = {}
        skipped = 0
        for img in imgs:
            found, skip = scan(name, img)
            if skip:
                skipped += 1
                continue
            has_rare[img] = bool(found & RARE)
            by_split[split_of(img, rng)].append(img)
        for split, items in by_split.items():
            rng.shuffle(items)
            items.sort(key=lambda p: not has_rare[p])  # stable: rare-class images first, random within
            limit = cap if split == 'train' else EVAL_CAP
            if limit:
                items = items[:limit]
            for i, img in enumerate(items):
                jobs.append((name, img, split, f'{name}_{split}_{i:05d}'))
        print(f'{name}: found {len(imgs)} images ({skipped} skipped)', flush=True)

    counts, per_source = Counter(), Counter()
    with Pool(4) as pool:
        for n, res in enumerate(pool.imap_unordered(process, jobs, chunksize=32), 1):
            if res:
                split, name, cls = res
                per_source[(name, split)] += 1
                for c in cls:
                    counts[(split, int(c))] += 1
            if n % 2000 == 0:
                print(f'  {n}/{len(jobs)}', flush=True)

    with open(os.path.join(OUT, 'data.yaml'), 'w', encoding='utf-8') as f:
        f.write(f'path: {OUT.replace(chr(92), "/")}\ntrain: images/train\nval: images/val\ntest: images/test\n')
        f.write(f'nc: {len(CLASSES)}\nnames:\n')
        for i, c in enumerate(CLASSES):
            f.write(f'  {i}: {c}\n')
    json.dump(CLASSES, open(os.path.join(OUT, 'classes.json'), 'w'))
    print('\nimages per source/split:')
    for k, v in sorted(per_source.items()):
        print(' ', k, v)
    print('\nboxes per class (train / val / test):')
    for i, c in enumerate(CLASSES):
        print(f'  {c:14s}', counts[('train', i)], counts[('val', i)], counts[('test', i)])


if __name__ == '__main__':
    sys.exit(main())
