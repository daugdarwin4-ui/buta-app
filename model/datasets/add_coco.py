"""
Add everyday photos (COCO val2017) to the merged dataset as "general world" examples.

Why: the first GuideAI model only ever saw street-hazard photos, so on anything else it forced
the nearest class it knew (a laptop screen was announced as "car"). These ~5,000 photos of rooms,
desks, food, animals, sports... teach it that most things are NOT hazards.

The photos start with empty labels; pseudo_label.py then lets the teacher model mark the people,
vehicles, benches, dogs... in them, so those classes also get more varied examples.

Run from model/datasets:
    ../train-venv/Scripts/python.exe add_coco.py
    ../train-venv/Scripts/python.exe pseudo_label.py coco_
"""
import os
import random
import sys
import zipfile
from multiprocessing import Pool

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ZIP = os.path.join(HERE, 'raw', 'coco_val2017.zip')
SRC = os.path.join(HERE, 'src', 'coco_val2017')
OUT = os.path.join(HERE, 'merged')
MAX_SIDE = 416
SEED = 42
VAL, TEST = 250, 250  # the rest goes to train


def process(job):
    path, split, name = job
    try:
        im = Image.open(path).convert('RGB')
    except Exception:
        return 0
    w, h = im.size
    scale = MAX_SIDE / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
    im.save(os.path.join(OUT, 'images', split, name + '.jpg'), quality=90)
    open(os.path.join(OUT, 'labels', split, name + '.txt'), 'w').close()  # empty: teacher fills it
    return 1


def main():
    if not os.path.isdir(SRC):
        print('unzipping...', flush=True)
        with zipfile.ZipFile(ZIP) as z:
            z.extractall(SRC)
    images = sorted(
        os.path.join(root, f) for root, _, files in os.walk(SRC) for f in files if f.lower().endswith('.jpg')
    )
    random.Random(SEED).shuffle(images)
    jobs = []
    for i, path in enumerate(images):
        split = 'val' if i < VAL else 'test' if i < VAL + TEST else 'train'
        jobs.append((path, split, f'coco_{split}_{i:05d}'))
    with Pool(4) as pool:
        done = sum(pool.imap_unordered(process, jobs, chunksize=64))
    # Ultralytics caches the label list per split; it must be rebuilt after adding files
    for split in ('train', 'val', 'test'):
        cache = os.path.join(OUT, 'labels', split + '.cache')
        if os.path.exists(cache):
            os.remove(cache)
    print(f'added {done} COCO images ({len(images) - VAL - TEST} train, {VAL} val, {TEST} test)')


if __name__ == '__main__':
    sys.exit(main())
