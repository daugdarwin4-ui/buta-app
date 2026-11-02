"""
Add labels for everyday objects (people, cars, dogs, benches...) that the specialised datasets
did not label, using a larger, accurate COCO model as a "teacher".

Why: a pothole photo usually has unlabeled cars and people in it. Left alone, the model would
learn "cars are background" and stop warning about them. The teacher fills those in.

A teacher box is only added when it does not overlap (IoU > 0.3) a box that a human labeled, so
the human labels (tricycles, jeepneys, stairs...) always win.

Run (after build_dataset.py):  ../train-venv/Scripts/python.exe pseudo_label.py [prefix]
With a prefix (e.g. coco_) only images whose file name starts with it are processed.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MERGED = os.path.join(HERE, 'merged')
TEACHER = os.path.join(HERE, '..', 'weights', 'yolo11m.pt')
CONF = 0.5
OVERLAP = 0.3

CLASSES = json.load(open(os.path.join(MERGED, 'classes.json')))
CID = {c: i for i, c in enumerate(CLASSES)}
# COCO class id -> unified class. Everything else the teacher sees is ignored.
COCO_TO_UNIFIED = {
    0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck', 9: 'traffic light',
    10: 'fire hydrant', 11: 'stop sign', 13: 'bench', 15: 'cat', 16: 'dog', 17: 'horse', 19: 'cow',
    56: 'chair', 58: 'potted plant',
}
# Datasets where a class is annotated by humans for ALL images: don't second-guess those classes
# (e.g. the Philippine vehicle sets label every tricycle/jeepney; the teacher would call them cars).
SKIP_PREFIX_FOR = {}


def iou_xyxy(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0


def read_existing(path):
    boxes = []
    if os.path.exists(path):
        for line in open(path):
            p = line.split()
            if len(p) == 5:
                c, cx, cy, w, h = int(p[0]), *map(float, p[1:])
                boxes.append((c, (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)))
    return boxes


def main():
    from ultralytics import YOLO
    model = YOLO(TEACHER)
    prefix = sys.argv[1] if len(sys.argv) > 1 else ''
    added = {}
    for split in ('train', 'val', 'test'):
        images = sorted(glob.glob(os.path.join(MERGED, 'images', split, prefix + '*.jpg')))
        print(f'{split}: {len(images)} images', flush=True)
        for start in range(0, len(images), 64):
            batch = images[start:start + 64]
            results = model.predict(batch, imgsz=416, conf=CONF, device=0, half=True, verbose=False,
                                    classes=list(COCO_TO_UNIFIED))
            for img, res in zip(batch, results):
                label_file = os.path.join(MERGED, 'labels', split, os.path.splitext(os.path.basename(img))[0] + '.txt')
                existing = read_existing(label_file)
                new_lines = []
                for box, cls in zip(res.boxes.xyxyn.tolist(), res.boxes.cls.tolist()):
                    name = COCO_TO_UNIFIED[int(cls)]
                    if any(iou_xyxy(box, e[1]) > OVERLAP for e in existing):
                        continue
                    x1, y1, x2, y2 = box
                    if x2 - x1 < 0.01 or y2 - y1 < 0.01:
                        continue
                    new_lines.append(f'{CID[name]} {(x1 + x2) / 2:.5f} {(y1 + y2) / 2:.5f} {x2 - x1:.5f} {y2 - y1:.5f}')
                    added[name] = added.get(name, 0) + 1
                if new_lines:
                    with open(label_file, 'a') as f:
                        f.write('\n'.join(new_lines) + '\n')
            if (start // 64) % 40 == 0:
                print(f'  {split} {start}/{len(images)}', flush=True)
    print('\nteacher boxes added per class:')
    for k, v in sorted(added.items(), key=lambda kv: -kv[1]):
        print(f'  {k:14s}{v}')


if __name__ == '__main__':
    sys.exit(main())
