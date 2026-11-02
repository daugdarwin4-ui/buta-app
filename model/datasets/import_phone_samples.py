"""
Turn pictures saved by the app's "Improve My AI" screen into verified training data.

Run from model/datasets with the training venv.

STEP 1 - import (after copying the phone's GuideAI-samples-... folder to the PC):
    ../train-venv/Scripts/python.exe import_phone_samples.py import "D:/path/GuideAI-samples-20261014_1415"
  Converts every picture to JPG in phone/review/ and writes the app's guesses as YOLO label files
  next to them, plus classes.txt. The guesses are SUGGESTIONS ONLY.

STEP 2 - check every picture by hand, in a labelling tool that reads YOLO format, e.g.
    ../train-venv/Scripts/pip.exe install labelImg
    ../train-venv/Scripts/labelImg.exe phone/review phone/review/classes.txt phone/review
  (set the format to YOLO). Fix wrong boxes, delete wrong ones, draw missed obstacles.
  A picture with nothing in it is fine: an empty label file teaches "nothing here".
  MOVE each finished picture and its .txt into phone/verified/.

STEP 3 - validate and add the verified pictures to the training set:
    ../train-venv/Scripts/python.exe import_phone_samples.py add
  Checks the labels (missing files, bad classes, boxes outside the picture, duplicates), then
  copies them into merged/{images,labels}/{train,val,test}. Pictures taken within the same few
  minutes go to the SAME split, so near-identical frames never end up in both train and test.
  Then retrain (train.py) and compare the new model with the old one before shipping it.
"""
import glob
import hashlib
import json
import os
import random
import shutil
import sys
from collections import Counter
from datetime import datetime

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MERGED = os.path.join(HERE, 'merged')
PHONE = os.path.join(HERE, 'phone')
REVIEW = os.path.join(PHONE, 'review')
VERIFIED = os.path.join(PHONE, 'verified')
ADDED_LOG = os.path.join(PHONE, 'added.json')

# Pictures taken within this many minutes of each other count as one scene (same split)
SCENE_GAP_MIN = 5
SPLIT_SHARES = (('train', 0.8), ('val', 0.1), ('test', 0.1))
SEED = 7


def load_classes():
    path = os.path.join(MERGED, 'classes.json')
    if not os.path.exists(path):
        sys.exit(f'Missing {path}: build the main dataset first (build_dataset.py).')
    return json.load(open(path, encoding='utf-8'))


def taken_at(stem):
    """gai_20261014_141530_unsure -> datetime, or None for names the app did not make"""
    try:
        _, day, time, *_ = stem.split('_')
        return datetime.strptime(day + time, '%Y%m%d%H%M%S')
    except ValueError:
        return None


def cmd_import(folder):
    classes = load_classes()
    cid = {name: i for i, name in enumerate(classes)}
    os.makedirs(REVIEW, exist_ok=True)
    with open(os.path.join(REVIEW, 'classes.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(classes) + '\n')

    done = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(PHONE, '*', '*.jpg'))}
    imported = skipped = 0
    taught = {}  # name the user typed with Teach -> pictures
    for bmp in sorted(glob.glob(os.path.join(folder, '*.bmp'))):
        stem = os.path.splitext(os.path.basename(bmp))[0]
        if stem in done:
            skipped += 1
            continue
        Image.open(bmp).convert('RGB').save(os.path.join(REVIEW, stem + '.jpg'), quality=92)
        lines = []
        meta = os.path.join(folder, stem + '.json')
        if os.path.exists(meta):
            info = json.load(open(meta, encoding='utf-8'))
            if info.get('userLabel'):
                taught.setdefault(info['userLabel'], []).append(stem)
            for s in info.get('suggestions', []):
                if s['label'] in cid:
                    lines.append(f"{cid[s['label']]} {s['x_center']:.6f} {s['y_center']:.6f} {s['width']:.6f} {s['height']:.6f}")
        with open(os.path.join(REVIEW, stem + '.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + ('\n' if lines else ''))
        imported += 1
    print(f'Imported {imported} pictures into {REVIEW} ({skipped} already imported).')
    if taught:
        # Teach pictures: the name is known, the box is not. Write a list to label from.
        with open(os.path.join(REVIEW, 'taught_names.txt'), 'a', encoding='utf-8') as f:
            for name, stems in sorted(taught.items()):
                f.write(f'{name}: {" ".join(stems)}\n')
        print('Objects named with Teach (draw a box around each in its picture):')
        for name, stems in sorted(taught.items()):
            status = f'class {cid[name]}' if name in cid else 'NOT a class yet - add it to CLASSES in build_dataset.py and HAZARD_CLASSES in mobile/src/constants/hazards.ts to train it'
            print(f'  {name}: {len(stems)} picture(s), {status}')
    print('Next: check every picture in a labelling tool, then move finished ones to phone/verified/.')


def validate(classes):
    """Returns (good stems, problems)"""
    problems, good, seen = [], [], {}
    for img in sorted(glob.glob(os.path.join(VERIFIED, '*.jpg'))):
        stem = os.path.splitext(os.path.basename(img))[0]
        label = os.path.join(VERIFIED, stem + '.txt')
        if not os.path.exists(label):
            problems.append(f'{stem}: no label file (an empty .txt means "nothing here")')
            continue
        digest = hashlib.md5(open(img, 'rb').read()).hexdigest()
        if digest in seen:
            problems.append(f'{stem}: same picture as {seen[digest]}')
            continue
        seen[digest] = stem
        ok = True
        for n, line in enumerate(open(label, encoding='utf-8'), 1):
            p = line.split()
            if not p:
                continue
            if len(p) != 5:
                problems.append(f'{stem}.txt line {n}: expected 5 numbers, got {len(p)}')
                ok = False
                continue
            cls, *box = p
            if not cls.isdigit() or int(cls) >= len(classes):
                problems.append(f'{stem}.txt line {n}: unknown class {cls}')
                ok = False
            x, y, w, h = map(float, box)
            if not (0 < w <= 1 and 0 < h <= 1 and 0 <= x - w / 2 + 1e-3 and x + w / 2 <= 1 + 1e-3
                    and 0 <= y - h / 2 + 1e-3 and y + h / 2 <= 1 + 1e-3):
                problems.append(f'{stem}.txt line {n}: box outside the picture')
                ok = False
        if ok:
            good.append(stem)
    for txt in glob.glob(os.path.join(VERIFIED, '*.txt')):
        stem = os.path.splitext(os.path.basename(txt))[0]
        if stem != 'classes' and not os.path.exists(os.path.join(VERIFIED, stem + '.jpg')):
            problems.append(f'{stem}.txt: no picture')
    return good, problems


def scenes(stems):
    """Group pictures taken within SCENE_GAP_MIN of each other"""
    timed = sorted(stems, key=lambda s: (taken_at(s) or datetime.min, s))
    groups, last = [], None
    for s in timed:
        t = taken_at(s)
        if not groups or t is None or last is None or (t - last).total_seconds() > SCENE_GAP_MIN * 60:
            groups.append([])
        groups[-1].append(s)
        last = t
    return groups


def cmd_add():
    classes = load_classes()
    good, problems = validate(classes)
    if problems:
        print('Fix these first (nothing was added):')
        for p in problems:
            print('  -', p)
        sys.exit(1)
    added = set(json.load(open(ADDED_LOG))) if os.path.exists(ADDED_LOG) else set()
    new = [s for s in good if s not in added]
    if not new:
        print('No new verified pictures to add.')
        return

    rng = random.Random(SEED)
    counts, boxes = Counter(), Counter()
    for group in scenes(new):
        r, split = rng.random(), 'train'
        acc = 0.0
        for name, share in SPLIT_SHARES:
            acc += share
            if r < acc:
                split = name
                break
        for stem in group:
            for kind, ext in (('images', '.jpg'), ('labels', '.txt')):
                dst = os.path.join(MERGED, kind, split, 'phone_' + stem + ext)
                shutil.copy2(os.path.join(VERIFIED, stem + ext), dst)
            for line in open(os.path.join(VERIFIED, stem + '.txt'), encoding='utf-8'):
                if line.split():
                    boxes[classes[int(line.split()[0])]] += 1
            counts[split] += 1
            added.add(stem)
    json.dump(sorted(added), open(ADDED_LOG, 'w'), indent=1)
    print(f'Added {len(new)} verified pictures: ' + ', '.join(f'{k} {v}' for k, v in counts.items()))
    print('Boxes per class: ' + (', '.join(f'{k} {v}' for k, v in boxes.most_common()) or 'none (all empty scenes)'))
    print('Next: retrain with train.py, then compare the new model with the current one before shipping.')


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'import':
        cmd_import(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == 'add':
        cmd_add()
    else:
        print(__doc__)
        sys.exit(2)
