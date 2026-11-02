"""
Build the v3 dataset for training on Google Colab: the existing 25 classes plus 20 everyday indoor
classes from COCO, and pack it as one zip to upload to Google Drive.

The existing dataset (merged/) is NOT changed. v3 is a separate copy (merged_v3/):
  - images are hard links to merged/images (no extra disk space),
  - labels are copied, then the YOLO11m "teacher" adds boxes for the 20 new classes on every image
    (it never replaces a human label: boxes overlapping an existing label are skipped).
The old class numbers 0-24 stay the same, so the app's rules for them don't change; the new classes
are 25-44.

Run from model/datasets:
    ../train-venv/Scripts/python.exe build_v3.py
Output: model/colab/guideai_v3_dataset.zip  (upload it to Google Drive, folder GuideAI)
"""
import glob
import json
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'merged')
DST = os.path.join(HERE, 'merged_v3')
TEACHER = os.path.join(HERE, '..', 'weights', 'yolo11m.pt')
ZIP_OUT = os.path.join(HERE, '..', 'colab', 'guideai_v3_dataset.zip')
CONF = 0.5
OVERLAP = 0.3

# New classes, appended after the existing 25: COCO class id -> GuideAI name
NEW_COCO = {
    60: 'table', 57: 'sofa', 59: 'bed', 61: 'toilet', 62: 'tv', 63: 'laptop', 66: 'keyboard',
    67: 'cell phone', 72: 'refrigerator', 68: 'microwave', 69: 'oven', 71: 'sink', 39: 'bottle',
    41: 'cup', 24: 'backpack', 26: 'handbag', 28: 'suitcase', 25: 'umbrella', 14: 'bird', 18: 'sheep',
}


def iou_xyxy(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0


def read_boxes(path):
    out = []
    if os.path.exists(path):
        for line in open(path):
            p = line.split()
            if len(p) == 5:
                cx, cy, w, h = map(float, p[1:])
                out.append((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
    return out


def copy_tree():
    for split in ('train', 'val', 'test'):
        os.makedirs(os.path.join(DST, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(DST, 'labels', split), exist_ok=True)
        for img in glob.glob(os.path.join(SRC, 'images', split, '*.jpg')):
            dst = os.path.join(DST, 'images', split, os.path.basename(img))
            if not os.path.exists(dst):
                try:
                    os.link(img, dst)           # hard link: no extra space
                except OSError:
                    shutil.copy2(img, dst)
        for lab in glob.glob(os.path.join(SRC, 'labels', split, '*.txt')):
            shutil.copy2(lab, os.path.join(DST, 'labels', split, os.path.basename(lab)))


def pseudo_label(classes):
    from ultralytics import YOLO
    cid = {c: i for i, c in enumerate(classes)}
    model = YOLO(TEACHER)
    added = {}
    for split in ('train', 'val', 'test'):
        images = sorted(glob.glob(os.path.join(DST, 'images', split, '*.jpg')))
        print(f'{split}: {len(images)} images', flush=True)
        for start in range(0, len(images), 64):
            batch = images[start:start + 64]
            results = model.predict(batch, imgsz=416, conf=CONF, device=0, half=True, verbose=False,
                                    classes=list(NEW_COCO))
            for img, res in zip(batch, results):
                lab = os.path.join(DST, 'labels', split, os.path.splitext(os.path.basename(img))[0] + '.txt')
                existing = read_boxes(lab)
                lines = []
                for box, cls in zip(res.boxes.xyxyn.tolist(), res.boxes.cls.tolist()):
                    x1, y1, x2, y2 = box
                    if x2 - x1 < 0.01 or y2 - y1 < 0.01 or any(iou_xyxy(box, e) > OVERLAP for e in existing):
                        continue
                    name = NEW_COCO[int(cls)]
                    lines.append(f'{cid[name]} {(x1 + x2) / 2:.5f} {(y1 + y2) / 2:.5f} {x2 - x1:.5f} {y2 - y1:.5f}')
                    added[name] = added.get(name, 0) + 1
                if lines:
                    with open(lab, 'a') as f:
                        f.write('\n'.join(lines) + '\n')
            if (start // 64) % 50 == 0:
                print(f'  {split} {start}/{len(images)}', flush=True)
    return added


def write_yaml(classes):
    json.dump(classes, open(os.path.join(DST, 'classes.json'), 'w'))
    with open(os.path.join(DST, 'data.yaml'), 'w') as f:
        # Path is set for Colab (the notebook unzips to /content/merged_v3)
        f.write('path: /content/merged_v3\ntrain: images/train\nval: images/val\ntest: images/test\n')
        f.write(f'nc: {len(classes)}\nnames:\n')
        for i, c in enumerate(classes):
            f.write(f'  {i}: {c}\n')


def make_zip():
    os.makedirs(os.path.dirname(ZIP_OUT), exist_ok=True)
    with zipfile.ZipFile(ZIP_OUT, 'w', zipfile.ZIP_STORED) as z:   # JPEGs don't compress further
        for root, _, files in os.walk(DST):
            for f in files:
                if f.endswith('.cache'):
                    continue
                full = os.path.join(root, f)
                z.write(full, os.path.relpath(full, HERE))
    print(f'zip: {ZIP_OUT} ({os.path.getsize(ZIP_OUT) / 1e6:.0f} MB)')


def main():
    base = json.load(open(os.path.join(SRC, 'classes.json')))
    classes = base + [n for n in NEW_COCO.values() if n not in base]
    print(f'{len(base)} existing + {len(classes) - len(base)} new = {len(classes)} classes', flush=True)
    copy_tree()
    added = pseudo_label(classes)
    print('\nteacher boxes added for the new classes:')
    for k, v in sorted(added.items(), key=lambda kv: -kv[1]):
        print(f'  {k:14s}{v}')
    write_yaml(classes)
    make_zip()


if __name__ == '__main__':
    sys.exit(main())
