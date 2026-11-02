"""
Train GuideAI's hazard detector (YOLO11n @ 320 px) on the merged dataset.

    cd model
    train-venv/Scripts/python.exe train.py            # full run (resumes automatically if interrupted)
    train-venv/Scripts/python.exe train.py --smoke    # 1 quick epoch on a small slice, to check the setup

Results land in model/runs/guideai/ (weights/best.pt, plots, results.csv).
Tuned for a 4 GB laptop GPU (RTX 2050): small batch, cached-free, few data-loader workers.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'datasets', 'merged', 'data.yaml')
RUNS = os.path.join(HERE, 'runs')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--smoke', action='store_true')
    ap.add_argument('--epochs', type=int, default=60)
    ap.add_argument('--batch', type=int, default=32)
    ap.add_argument('--name', default='guideai')
    ap.add_argument('--base', default=os.path.join(HERE, 'weights', 'yolo11n.pt'),
                    help='weights to start from (a previous best.pt to continue improving a model)')
    ap.add_argument('--cache', default='', choices=['', 'disk', 'ram'],
                    help="'disk' pre-decodes the photos once (several GB) for faster epochs")
    args = ap.parse_args()

    from ultralytics import YOLO

    last = os.path.join(RUNS, args.name, 'weights', 'last.pt')
    if not args.smoke and os.path.exists(last):
        print('Resuming interrupted run from', last)
        YOLO(last).train(resume=True)
        return

    model = YOLO(args.base)  # COCO-pretrained by default: keeps what it knows
    model.train(
        data=DATA,
        imgsz=320,            # must match the app (YOLO_INPUT_SIZE)
        epochs=1 if args.smoke else args.epochs,
        batch=args.batch,
        fraction=0.03 if args.smoke else 1.0,
        device=0,
        workers=4,
        cache=args.cache or False,
        project=RUNS,
        name='smoke' if args.smoke else args.name,
        exist_ok=True,
        patience=15,          # stop early if validation stops improving
        cos_lr=True,
        close_mosaic=10,      # last 10 epochs without mosaic: closer to what the phone sees
        # Phone-in-hand street photos: moderate colour/scale changes, no vertical flips
        hsv_h=0.015, hsv_s=0.6, hsv_v=0.4,
        degrees=5, translate=0.1, scale=0.5, fliplr=0.5, flipud=0.0,
        mosaic=1.0, mixup=0.05,
        amp=True,
        plots=True,
        val=True,
    )


if __name__ == '__main__':
    sys.exit(main())
