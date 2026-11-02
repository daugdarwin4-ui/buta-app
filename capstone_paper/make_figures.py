"""
Builds the figures for the GuideAI capstone paper into capstone_paper/figures/.
Run:  model\\train-venv\\Scripts\\python.exe capstone_paper\\make_figures.py
Every number comes from real files: model/runs/*/results.csv and eval_results.json
(test-split evaluation of both models).
"""
import csv
import json
import os
import shutil

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIG = os.path.join(HERE, 'figures')
os.makedirs(FIG, exist_ok=True)

BLUE, ORANGE = '#2a78d6', '#eb6834'
INK, INK2, GRID = '#1f2328', '#57606a', '#e5e7eb'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': GRID,
                     'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2})


def box(ax, x, y, w, h, text, fc='#ffffff', ec=BLUE, bold=False, size=9):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.02,rounding_size=0.08',
                                fc=fc, ec=ec, lw=1.4))
    ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=size, color=INK,
            fontweight='bold' if bold else 'normal', wrap=True)


def arrow(ax, x1, y1, x2, y2, dashed=False):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=INK2, lw=1.3, ls='--' if dashed else '-'))


def architecture():
    fig, ax = plt.subplots(figsize=(10, 6.2))
    ax.set_xlim(0, 10); ax.set_ylim(0, 6.2); ax.axis('off')
    # Phone boundary
    ax.add_patch(FancyBboxPatch((0.15, 0.95), 6.7, 5.05, boxstyle='round,pad=0.02,rounding_size=0.15',
                                fc='#f6f8fa', ec='#8c959f', lw=1.2))
    ax.text(0.35, 5.75, 'Android smartphone (GuideAI app, runs offline)', fontsize=10, color=INK, fontweight='bold')
    box(ax, 0.4, 4.55, 1.6, 0.8, 'Back camera\n(VisionCamera)')
    box(ax, 2.35, 4.55, 2.0, 0.8, 'YOLO11n TFLite\n25 classes, 320 px', bold=True)
    box(ax, 4.7, 4.55, 1.9, 0.8, 'Tracker +\nhazard classifier')
    box(ax, 4.7, 3.25, 1.9, 0.8, 'Hazard announcer\n(priority, cooldown)')
    box(ax, 2.35, 3.25, 2.0, 0.8, 'Text-to-speech +\nvibration')
    box(ax, 0.4, 3.25, 1.6, 0.8, 'Voice commands\n(speech recognition)')
    box(ax, 0.4, 1.25, 1.6, 0.8, 'Text reader\n(ML Kit OCR)')
    box(ax, 2.35, 1.25, 2.0, 0.8, 'Navigation\n(GPS + OSRM)')
    box(ax, 4.7, 1.25, 1.9, 0.8, 'Emergency SOS\n(SMS from SIM)', ec=ORANGE)
    box(ax, 2.35, 2.25, 2.0, 0.65, 'Settings & contacts\n(on-device storage)', size=8)
    arrow(ax, 2.0, 4.95, 2.35, 4.95); arrow(ax, 4.35, 4.95, 4.7, 4.95)
    arrow(ax, 5.65, 4.55, 5.65, 4.05); arrow(ax, 4.7, 3.65, 4.35, 3.65)
    arrow(ax, 2.0, 3.65, 2.35, 3.65)
    # Outside the phone
    box(ax, 7.4, 4.45, 2.4, 1.0, 'Google Gemini API\n(optional, online)\nAI object names,\nvoice assistant', ec='#8250df', size=8)
    box(ax, 7.4, 2.95, 2.4, 0.9, 'OpenStreetMap services\n(geocoding, routes)', ec='#8250df', size=8)
    box(ax, 7.4, 1.45, 2.4, 0.9, 'Mobile network\n(SMS to contacts)', ec=ORANGE, size=8)
    box(ax, 7.4, 0.1, 2.4, 0.95, 'Smart cane, ESP32\n(PLANNED; protocol\ndefined, simulated)', ec='#8c959f', size=8)
    arrow(ax, 6.6, 4.95, 7.4, 4.95, dashed=True)
    arrow(ax, 4.35, 1.65, 7.4, 3.3, dashed=True)
    arrow(ax, 6.6, 1.65, 7.4, 1.9)
    arrow(ax, 7.4, 0.6, 6.6, 3.45, dashed=True)
    ax.text(0.2, 0.35, 'Solid arrows: always available offline.  Dashed: needs internet or optional hardware.',
            fontsize=8, color=INK2)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_architecture.png'), dpi=200)
    plt.close(fig)


def pipeline():
    steps = [
        ('Camera frame', '~3 per second'),
        ('Letterbox to 320 x 320', 'RGB, worklet thread'),
        ('Can the camera see?', 'dark / covered check'),
        ('YOLO11n inference', 'on-device TFLite'),
        ('Per-class confidence filter', '+ full-frame guess filter'),
        ('Multi-frame tracker', '2-of-3 confirmation, approaching'),
        ('Direction, distance band,\nwalking-path relevance', 'left / ahead / right'),
        ('Spoken warning', '"Careful, stairs ahead."'),
    ]
    fig, ax = plt.subplots(figsize=(6.2, 8.4))
    ax.set_xlim(0, 6.2); ax.set_ylim(0, len(steps) * 1.0 + 0.2); ax.axis('off')
    for i, (title, sub) in enumerate(steps):
        y = (len(steps) - 1 - i) * 1.0 + 0.25
        box(ax, 0.6, y, 5.0, 0.68, f'{title}\n{sub}', ec=ORANGE if i == len(steps) - 1 else BLUE, size=9)
        if i < len(steps) - 1:
            arrow(ax, 3.1, y, 3.1, y - 0.32)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_pipeline.png'), dpi=200)
    plt.close(fig)


def read_map50(run):
    with open(os.path.join(ROOT, 'model', 'runs', run, 'results.csv')) as f:
        rows = list(csv.DictReader(f))
    key = next(k for k in rows[0] if 'mAP50(B)' in k and '95' not in k)
    return [int(float(r['epoch'])) for r in rows], [float(r[key]) for r in rows]


def training_curves():
    fig, ax = plt.subplots(figsize=(8, 4))
    for run, color, label in (('guideai', BLUE, 'Model v1 (60 epochs)'), ('guideai_v2', ORANGE, 'Model v2 (stopped at epoch 37 of 45)')):
        e, m = read_map50(run)
        ax.plot(e, m, color=color, lw=2, label=label)
        ax.text(e[-1] + 0.6, m[-1], f'{m[-1]:.2f}', color=INK, va='center', fontsize=9)
    ax.set_xlabel('Epoch'); ax.set_ylabel('Validation mAP50')
    ax.set_ylim(0, 1); ax.grid(axis='y', color=GRID); ax.spines[['top', 'right']].set_visible(False)
    ax.legend(frameon=False, loc='lower right')
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_training_curves.png'), dpi=200)
    plt.close(fig)


def per_class(evals):
    k1, k2 = list(evals)
    classes = sorted(evals[k2]['per_class'], key=lambda c: evals[k2]['per_class'][c]['mAP50'])
    v1 = [evals[k1]['per_class'].get(c, {}).get('mAP50', 0) for c in classes]
    v2 = [evals[k2]['per_class'][c]['mAP50'] for c in classes]
    fig, ax = plt.subplots(figsize=(8, 9))
    y = range(len(classes))
    h = 0.38
    ax.barh([i + h / 2 + 0.01 for i in y], v1, height=h, color=BLUE, label='Model v1 (in the app)')
    ax.barh([i - h / 2 - 0.01 for i in y], v2, height=h, color=ORANGE, label='Model v2 (retrained)')
    ax.set_yticks(list(y)); ax.set_yticklabels(classes)
    ax.set_xlim(0, 1); ax.set_xlabel('Test mAP50 (higher is better)')
    ax.grid(axis='x', color=GRID); ax.spines[['top', 'right']].set_visible(False)
    for i, val in enumerate(v2):
        ax.text(val + 0.01, i - h / 2 - 0.01, f'{val:.2f}', va='center', fontsize=7.5, color=INK)
    ax.legend(frameon=False, loc='lower right')
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_per_class.png'), dpi=200)
    plt.close(fig)


def copy_screens():
    scratch = os.environ.get('GUIDEAI_SCREENS')
    if not scratch:
        return
    picks = {
        'scr_home.png': 'scan/x1_home.png', 'scr_detect_person.png': 'v1.png',
        'scr_detect_clear.png': 'v2.png', 'scr_detect_dark.png': 'r3_dark.png',
        'scr_detect_classroom.png': 'r2_4.png', 'scr_navigate.png': 'scan/v2_navigate.png',
        'scr_nav_steps.png': 'scan/14_nav_after.png', 'scr_read.png': 'scan/04_read.png',
        'scr_voice.png': 'scan/v4_voice.png', 'scr_settings.png': 'scan/x2_settings.png',
        'scr_sos.png': 'scan/09_sos.png', 'scr_add_contact.png': 'scan/12_add_contact.png',
        'fig_gemini_boxes.png': 'boxes_check.png',
    }
    for dst, src in picks.items():
        p = os.path.join(scratch, src)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(FIG, dst))
    for name in ('confusion_matrix_normalized.png',):
        shutil.copy2(os.path.join(ROOT, 'model', 'runs', 'guideai', name), os.path.join(FIG, 'fig_confusion_v1.png'))


if __name__ == '__main__':
    evals_path = os.path.join(HERE, 'eval_results.json')
    evals = json.load(open(evals_path))
    architecture(); pipeline(); training_curves(); per_class(evals); copy_screens()
    print(sorted(os.listdir(FIG)))
