"""
Live view of the YOLO training progress. Read-only: it never touches the training itself.

    cd model
    train-venv/Scripts/python.exe watch_training.py     (Ctrl+C to stop watching; training keeps going)
"""
import csv
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LOGS = [os.path.join(HERE, n) for n in ('train_v2.log', 'train_resume.log', 'train.log')]
# The most recently updated run (guideai_v2 once the retraining starts)
RUN_RESULTS = [os.path.join(HERE, 'runs', n, 'results.csv') for n in ('guideai_v2', 'guideai')]
PIPELINE_LOG = os.path.join(HERE, 'retrain_v2.log')
# e.g. "      39/60      1.51G  1.088 ... 320: 57% ━━━━━━╸───── 322/560 4.9it/s 1:03<49.0s"
PROGRESS = re.compile(r'(\d+)/(\d+)\s+[\d.]+G.*?(\d+)%.*?(\d+)/(\d+)\s+([\d.]+it/s|[\d.]+s/it)\s+([\d:]+)<([\d:.]+s?)')


def latest_progress():
    """Progress from the log the CURRENT run writes to (the most recently modified one).
    Never falls back to an older run's log: between epochs (validation) the newest log has
    no training line in its tail, which is reported as 'validating' instead."""
    logs = [p for p in LOGS if os.path.exists(p)]
    if not logs:
        return None, None
    path = max(logs, key=os.path.getmtime)
    mtime = os.path.getmtime(path)
    with open(path, 'rb') as f:
        f.seek(max(0, os.path.getsize(path) - 200000))
        tail = f.read().decode('utf-8', 'ignore')
    for line in reversed(re.split(r'[\r\n]', tail)):
        m = PROGRESS.search(line)
        if m:
            return m.groups(), mtime
    return None, mtime


def results():
    existing = [p for p in RUN_RESULTS if os.path.exists(p)]
    if not existing:
        return []
    with open(max(existing, key=os.path.getmtime)) as f:
        rows = list(csv.DictReader(f))
    return [{k.strip(): v.strip() for k, v in r.items()} for r in rows]


def bar(pct, width=30):
    done = int(width * pct / 100)
    return '█' * done + '░' * (width - done)


def main():
    while True:
        rows = results()
        prog, mtime = latest_progress()
        out = ['GuideAI YOLO training — live (Ctrl+C to stop watching; training continues)', '']
        if os.path.exists(PIPELINE_LOG):
            with open(PIPELINE_LOG, encoding='utf-8-sig', errors='ignore') as f:
                steps = [l.strip() for l in f if l.strip()]
            if steps:
                out += ['Pipeline: ' + steps[-1], '']
        if prog:
            epoch, total, pct, it, its, speed, _, left = prog
            stale = time.time() - mtime > 120
            out.append(f'Epoch {epoch}/{total}   [{bar(int(pct))}] {pct}%   batch {it}/{its}   {speed}   this epoch: {left} left')
            if rows and len(rows) > 1:
                secs = float(rows[-1]['time']) - float(rows[-2]['time'])
                remaining = (int(total) - int(epoch) + 1) * secs
                out.append(f'About {remaining / 60:.0f} min left for all epochs (≈{secs / 60:.1f} min per epoch, may stop early if it stops improving)')
            if stale:
                out.append('⚠ No progress for over 2 minutes: training may have stopped. Tell Claude.')
        elif mtime and time.time() - mtime < 120:
            out.append('Checking accuracy on validation photos (between epochs)...')
        elif mtime:
            out.append('⚠ No progress for over 2 minutes: training may have stopped. Tell Claude.')
        else:
            out.append('No training progress found yet.')
        if rows:
            out += ['', 'Accuracy after each epoch (higher is better):', '  epoch   mAP50   mAP50-95   precision   recall']
            for r in rows[-8:]:
                out.append(f"  {int(float(r['epoch'])):>5}   {float(r['metrics/mAP50(B)']):.3f}   {float(r['metrics/mAP50-95(B)']):.3f}"
                           f"      {float(r['metrics/precision(B)']):.3f}     {float(r['metrics/recall(B)']):.3f}")
            best = max(rows, key=lambda r: float(r['metrics/mAP50-95(B)']))
            out.append(f"\n  Best so far: epoch {int(float(best['epoch']))}  mAP50 {float(best['metrics/mAP50(B)']):.3f}")
        os.system('cls' if os.name == 'nt' else 'clear')
        print('\n'.join(out), flush=True)
        if prog and int(prog[0]) == int(prog[1]) and int(prog[2]) == 100:
            print('\nLast epoch running / finished.')
        time.sleep(5)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
