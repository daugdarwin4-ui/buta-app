"""
Two front-view pictures of the GuideAI smart cane hardware:
  hardware/parts_overview.png   — every part that was ordered, drawn as it looks, numbered, with quantity and job
  hardware/cane_front_view.png  — the cane seen from the front with every part in place (same numbers);
                                   the box lid is drawn see-through so the parts inside are visible
Run:  model\\train-venv\\Scripts\\python.exe hardware\\make_front_blueprint.py
Positions match hardware/box_layout.png and hardware/cane_layout.png (make_cane_layout.py).
"""
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle, Wedge, Ellipse

HERE = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({'font.family': 'DejaVu Sans'})
INK, INK2 = '#1f2328', '#57606a'
BLUE_PCB, BLACK_PCB, PURPLE_PCB = '#1b4f9c', '#202020', '#5b2a86'
SILVER, GOLD = '#c3c7cb', '#d4a72c'
BP_BG, BP_LINE = '#0f3057', '#e8f1fb'   # blueprint style for the cane view


def rr(ax, x, y, w, h, fc, ec=INK, lw=1.2, r=0.25, z=3, ls='-', alpha=1.0):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f'round,pad=0,rounding_size={r}', fc=fc, ec=ec, lw=lw,
                                zorder=z, ls=ls, alpha=alpha))


def pins(ax, x0, x1, y, n, color=GOLD, size=2.2):
    import numpy as np
    for x in np.linspace(x0, x1, n):
        ax.plot(x, y, 's', ms=size, color=color, zorder=6)


# ─────────────────────────────── part drawings (card space 0..10 x 0..10) ───────────────────────────────
def d_esp32(ax):
    rr(ax, 1.2, 2.4, 7.6, 4.4, BLACK_PCB)
    rr(ax, 5.6, 3.1, 2.6, 3.0, SILVER, r=0.1, z=4)
    ax.text(6.9, 4.6, 'ESP-WROOM\n-32', ha='center', va='center', fontsize=5, color=INK, zorder=5)
    rr(ax, 0.8, 4.0, 0.9, 1.2, SILVER, r=0.05, z=4)
    pins(ax, 1.6, 8.4, 2.75, 15); pins(ax, 1.6, 8.4, 6.45, 15)
    ax.plot(2.6, 4.6, 'o', ms=3, color='#ff4d4d', zorder=5)


def d_rcwl(ax):
    rr(ax, 0.8, 3.0, 8.4, 3.6, BLUE_PCB)
    for cx in (2.9, 7.1):
        ax.add_patch(Circle((cx, 4.8), 1.55, fc=SILVER, ec='#555', lw=1.2, zorder=4))
        ax.add_patch(Circle((cx, 4.8), 1.1, fc='#7d8590', ec='#555', lw=0.8, zorder=5))
    pins(ax, 4.2, 5.8, 3.35, 4)
    ax.text(5, 6.1, 'RCWL-1601', ha='center', fontsize=5.5, color='white', zorder=5)


def d_vl53(ax):
    rr(ax, 3.2, 3.0, 3.6, 3.8, PURPLE_PCB)
    rr(ax, 4.4, 4.5, 1.2, 0.8, BLACK_PCB, r=0.05, z=4)
    ax.plot([4.75, 5.25], [4.9, 4.9], 'o', ms=2.2, color='#ffb703', zorder=5)
    pins(ax, 3.6, 6.4, 3.35, 6)


def d_mpu(ax):
    rr(ax, 2.8, 3.0, 4.4, 3.6, BLUE_PCB)
    rr(ax, 4.3, 4.3, 1.4, 1.4, BLACK_PCB, r=0.05, z=4)
    pins(ax, 3.1, 6.9, 3.35, 8)
    ax.text(5, 6.1, 'GY-521', ha='center', fontsize=5.5, color='white', zorder=5)


def d_tp4056(ax):
    rr(ax, 2.0, 3.2, 6.0, 3.2, BLUE_PCB)
    rr(ax, 1.5, 4.2, 1.2, 1.2, SILVER, r=0.3, z=4)
    ax.plot([4.4, 5.2], [5.6, 5.6], 'o', ms=3, color='#ff4d4d', zorder=5)
    ax.plot(5.2, 5.6, 'o', ms=3, color='#4dd04d', zorder=5)
    for i, t in enumerate(('B+', 'B−', 'OUT+', 'OUT−')):
        ax.text(3.6 + i * 1.15, 3.6, t, ha='center', fontsize=4.2, color='white', zorder=5)


def d_mt3608(ax):
    rr(ax, 1.4, 3.4, 7.2, 3.0, BLUE_PCB)
    rr(ax, 5.7, 4.0, 1.6, 1.6, '#4cc9f0', r=0.1, z=4)
    ax.plot(6.5, 4.8, '+', ms=6, color=INK, zorder=5, mew=1.5)
    rr(ax, 3.0, 4.2, 1.6, 1.4, BLACK_PCB, r=0.05, z=4)
    for x in (1.9, 8.1):
        ax.plot([x, x], [3.9, 5.9], 'o', ms=3, color=GOLD, zorder=5)


def d_battery(ax):
    rr(ax, 1.6, 3.6, 6.6, 2.4, '#2a9d8f', ec='#1d6b62', r=1.1)
    rr(ax, 8.1, 4.3, 0.5, 1.0, SILVER, r=0.1, z=4)
    ax.text(4.9, 4.8, '18650  3.7 V', ha='center', va='center', fontsize=6, color='white', fontweight='bold', zorder=5)


def d_holder(ax):
    rr(ax, 0.9, 2.6, 8.2, 4.6, '#222222')
    for y in (3.3, 5.1):
        rr(ax, 1.3, y, 7.4, 1.6, '#3a3a3a', ec='#555', r=0.6, z=4)
    ax.plot([0.9, 0.3], [6.8, 7.6], color='#d62828', lw=2, zorder=5)
    ax.plot([0.9, 0.3], [3.0, 2.2], color=INK, lw=2, zorder=5)


def d_switch(ax):
    rr(ax, 3.0, 4.0, 4.0, 1.8, '#222222', r=0.1)
    rr(ax, 4.4, 5.8, 1.0, 1.0, '#777', r=0.1)
    for x in (3.8, 5.0, 6.2):
        ax.plot([x, x], [4.0, 2.8], color=SILVER, lw=2.2, zorder=2)


def d_button(ax):
    ax.add_patch(Circle((3.6, 4.8), 2.2, fc=SILVER, ec='#555', lw=1.4, zorder=3))
    ax.add_patch(Circle((3.6, 4.8), 1.5, fc='#d62828', ec='#8b0000', lw=1, zorder=4))
    ax.add_patch(Circle((7.2, 4.8), 1.6, fc=SILVER, ec='#555', lw=1.4, zorder=3))
    ax.add_patch(Circle((7.2, 4.8), 1.05, fc='#e9ecef', ec='#888', lw=1, zorder=4))
    ax.text(3.6, 2.0, 'SOS', ha='center', fontsize=6, color=INK)
    ax.text(7.2, 2.0, 'MODE', ha='center', fontsize=6, color=INK)


def d_resistors(ax):
    for i, bands in enumerate((('#8b4513', '#000', '#d62828'), ('#8b4513', '#000', '#f77f00'),
                               ('#d62828', '#d62828', '#8b4513'))):
        y = 6.2 - i * 1.6
        ax.plot([1.0, 9.0], [y, y], color=SILVER, lw=1.6, zorder=2)
        rr(ax, 3.4, y - 0.45, 3.2, 0.9, '#e9d6a5', ec='#b49a60', r=0.4, z=3)
        for k, c in enumerate(bands):
            ax.add_patch(Rectangle((3.9 + k * 0.6, y - 0.45), 0.25, 0.9, fc=c, ec='none', zorder=4))
    ax.text(5, 1.7, '1 kΩ, 10 kΩ, 100 kΩ (from the kit)', ha='center', fontsize=5.3, color=INK2)


def d_breadboard(ax):
    rr(ax, 0.8, 2.4, 8.4, 4.8, '#f4f4f2', ec='#aaa')
    for y, c in ((6.8, '#d62828'), (6.5, '#2a78d6'), (3.1, '#d62828'), (2.8, '#2a78d6')):
        ax.plot([1.1, 8.9], [y, y], color=c, lw=0.8, zorder=4)
    import numpy as np
    for x in np.arange(1.3, 8.8, 0.35):
        for y in np.arange(3.5, 6.2, 0.35):
            ax.plot(x, y, 's', ms=1.1, color='#9aa0a6', zorder=4)


def d_jumpers(ax):
    for i, c in enumerate(('#d62828', '#f77f00', '#e9c46a', '#2a9d8f', '#3a86ff', '#8338ec')):
        y = 6.6 - i * 0.75
        ax.plot([2.0, 8.0], [y, y], color=c, lw=2.2, zorder=3)
        ax.add_patch(Rectangle((1.2, y - 0.25), 0.8, 0.5, fc='#222', zorder=4))
        ax.add_patch(Rectangle((8.0, y - 0.25), 0.8, 0.5, fc='#222', zorder=4))
    ax.text(5, 1.6, 'male-male · male-female · female-female', ha='center', fontsize=5.3, color=INK2)


def d_motor(ax):
    ax.add_patch(Circle((4.0, 4.8), 1.9, fc=SILVER, ec='#555', lw=1.3, zorder=3))
    ax.add_patch(Circle((4.0, 4.8), 1.2, fc='#e2e5e8', ec='#888', lw=0.8, zorder=4))
    ax.plot([5.6, 8.8], [5.3, 6.4], color='#d62828', lw=1.6, zorder=2)
    ax.plot([5.6, 8.8], [4.6, 4.1], color='#1d1d1d', lw=1.6, zorder=2)
    ax.text(4.0, 2.2, '10 × 3 mm', ha='center', fontsize=6, color=INK2)


def d_buzzer(ax):
    ax.add_patch(Circle((5, 5.2), 1.9, fc='#1d1d1d', ec='#000', lw=1.2, zorder=3))
    ax.add_patch(Circle((5, 5.2), 0.35, fc='#555', zorder=4))
    ax.text(5, 6.4, '+', ha='center', fontsize=9, color='white', fontweight='bold', zorder=5)
    ax.plot([4.4, 4.4], [3.3, 1.7], color=SILVER, lw=1.6, zorder=2)
    ax.plot([5.6, 5.6], [3.3, 2.3], color=SILVER, lw=1.6, zorder=2)


def d_transistor(ax):
    ax.add_patch(Wedge((5, 5.4), 1.5, 0, 180, fc='#222', ec='#000', zorder=3))
    ax.add_patch(Rectangle((3.5, 4.2), 3.0, 1.2, fc='#222', ec='#000', zorder=3))
    for i, t in enumerate(('E', 'B', 'C')):
        x = 4.1 + i * 0.9
        ax.plot([x, x], [4.2, 2.4], color=SILVER, lw=1.8, zorder=2)
        ax.text(x, 1.8, t, ha='center', fontsize=6.5, fontweight='bold', color=INK)


def d_diode(ax):
    ax.plot([1.0, 9.0], [4.8, 4.8], color=SILVER, lw=1.6, zorder=2)
    rr(ax, 3.6, 4.2, 2.8, 1.2, '#1d1d1d', r=0.5, z=3)
    ax.add_patch(Rectangle((5.6, 4.2), 0.45, 1.2, fc='#c3c7cb', ec='none', zorder=4))
    ax.text(5.8, 3.4, 'stripe', ha='center', fontsize=5.5, color=INK2)


def d_perfboard(ax):
    rr(ax, 1.2, 2.2, 7.6, 5.2, '#d8b46a', ec='#8c6d2c', r=0.1)
    import numpy as np
    for x in np.arange(1.6, 8.6, 0.4):
        for y in np.arange(2.6, 7.2, 0.4):
            ax.plot(x, y, 'o', ms=1.4, color='#a07b33', zorder=4)


def d_headers(ax):
    for y in (5.6, 3.9):
        ax.add_patch(Rectangle((1.0, y), 8.0, 0.9, fc='#1d1d1d', zorder=3))
        import numpy as np
        for x in np.arange(1.35, 8.9, 0.5):
            ax.plot(x, y + 0.45, 's', ms=1.6, color='#555', zorder=4)


def d_box(ax):
    ax.add_patch(Polygon([[1.0, 2.6], [7.6, 2.6], [9.0, 3.8], [9.0, 6.8], [2.4, 6.8], [1.0, 5.6]], closed=True,
                         fc='#d9dcdf', ec=INK, lw=1.2, zorder=3))
    ax.plot([1.0, 7.6, 9.0], [5.6, 5.6, 6.8], color=INK, lw=1.0, zorder=4)
    ax.plot([7.6, 7.6], [2.6, 5.6], color=INK, lw=1.0, zorder=4)
    ax.text(4.3, 4.1, '158 × 90', ha='center', fontsize=6.5, color=INK, zorder=5)


def d_clamp(ax):
    ax.add_patch(Circle((4.6, 4.8), 2.2, fc='none', ec=SILVER, lw=4, zorder=3))
    rr(ax, 6.3, 5.6, 1.6, 1.0, SILVER, ec='#666', r=0.1, z=4)
    ax.plot(7.1, 6.1, '+', ms=6, color=INK, zorder=5)


def d_cane(ax):
    ax.add_patch(Rectangle((0.6, 4.55), 6.2, 0.5, fc='white', ec='#999', lw=1, zorder=3))
    ax.add_patch(Rectangle((0.6, 4.55), 1.3, 0.5, fc='#d62828', ec='#999', lw=1, zorder=4))
    rr(ax, 6.8, 4.35, 2.6, 0.9, '#2b2b2b', r=0.3, z=3)


def d_solder(ax):
    ax.plot([1.2, 6.2], [3.4, 6.2], color='#999', lw=2.2, zorder=3)
    rr(ax, 5.4, 5.4, 3.2, 1.3, '#1d1d1d', r=0.5, z=4)
    ax.plot([0.9, 1.4], [3.2, 3.5], color='#555', lw=3, zorder=4)
    ax.add_patch(Circle((7.6, 3.0), 0.9, fc=SILVER, ec='#666', zorder=3))
    ax.text(7.6, 1.7, 'solder', ha='center', fontsize=5.5, color=INK2)


def d_meter(ax):
    rr(ax, 3.0, 1.8, 4.0, 6.0, '#f2c400', ec='#8a6d00', r=0.5)
    rr(ax, 3.5, 5.6, 3.0, 1.6, '#cfe8cf', ec='#666', r=0.1, z=4)
    ax.text(5, 6.4, '4.20', ha='center', va='center', fontsize=8, fontweight='bold', zorder=5)
    ax.add_patch(Circle((5, 3.6), 1.0, fc='#333', zorder=4))


# number, drawing, name, qty, job, where it goes, group
PARTS = [
    (1, d_esp32, 'ESP32 DevKit V1', '2 (1 spare)', 'the brain; Bluetooth to the app', 'inside the box', 'Electronics'),
    (2, d_rcwl, 'RCWL-1601 ultrasonic', '2 (1 spare)', 'obstacles ahead at chest/head height', 'on the lid, on a wedge', 'Electronics'),
    (3, d_vl53, 'VL53L0X laser (ToF)', '1', 'holes, drops and curbs on the ground', 'tip-end wall window', 'Electronics'),
    (4, d_mpu, 'MPU6050 (GY-521)', '1', 'fall detection', 'inside the box, flat', 'Electronics'),
    (5, d_tp4056, 'TP4056 USB-C charger', '1', 'charges the batteries', 'box, grip-end wall', 'Power'),
    (6, d_mt3608, 'MT3608 boost', '1', 'battery → 5.0 V for the ESP32', 'inside the box', 'Power'),
    (7, d_battery, '18650 battery 3.7 V', '2', 'power', 'in the holder', 'Power'),
    (8, d_holder, '2 × 18650 holder', '1', 'holds the batteries (PARALLEL)', 'inside the box', 'Power'),
    (9, d_switch, 'SS12D00G3 slide switch', '1', 'ON/OFF', 'box, grip-end wall', 'Power'),
    (10, d_button, '16 mm metal push buttons', '2', 'SOS and MODE', 'top of the grip', 'Controls & feedback'),
    (11, d_motor, 'Coin vibration motor 3 V', '3 (2 spare)', 'buzzes in the hand', 'inside the grip', 'Controls & feedback'),
    (12, d_buzzer, 'Active buzzer 3.3 V', '2 (1 spare)', 'loud beep when very close', 'inside the box', 'Controls & feedback'),
    (13, d_transistor, 'S8050 transistors', '1 pack', 'switch the motor and buzzer', 'on the perfboard', 'Small parts'),
    (14, d_diode, '1N4148 / 1N4007 diodes', '1 pack', 'protect the ESP32 from the motor', 'on the perfboard', 'Small parts'),
    (15, d_resistors, 'DIP resistor kit', '1 kit', '1 kΩ ×2, 10 kΩ ×2, 100 kΩ ×2', 'on the perfboard', 'Small parts'),
    (16, d_headers, 'Female pin headers', '1 pack', 'ESP32 plugs in, not soldered', 'on the perfboard', 'Small parts'),
    (17, d_perfboard, 'Perfboard', '2', 'final circuit board', 'inside the box', 'Building'),
    (18, d_breadboard, 'Solderless breadboard', '1', 'testing before soldering', 'workbench only', 'Building'),
    (19, d_jumpers, 'Jumper wires', '3 sets', 'testing connections', 'workbench only', 'Building'),
    (20, d_box, 'ABS project box', '1', 'holds the electronics', 'on the shaft below the grip', 'Building'),
    (21, d_clamp, 'Hose clamps 3/4"', '2–3', 'hold the box on the cane', 'around the shaft', 'Building'),
    (22, d_cane, 'Folding white cane', '1', 'the base', '—', 'Building'),
    (23, d_solder, 'Soldering iron kit', '1', 'soldering the perfboard', 'tool', 'Tools'),
    (24, d_meter, 'Digital multimeter', '1', 'check battery & set MT3608 to 5.0 V', 'tool', 'Tools'),
]

GROUP_COLOR = {'Electronics': '#2a78d6', 'Power': '#d62828', 'Controls & feedback': '#ff006e',
               'Small parts': '#6a4c93', 'Building': '#8c6d2c', 'Tools': '#57606a'}


def parts_overview():
    cols, rows = 6, 4
    fig = plt.figure(figsize=(19, 14))
    fig.suptitle('GuideAI smart cane — every part you ordered (front views, numbered)', fontsize=17,
                 fontweight='bold', x=0.02, ha='left', y=0.985, color=INK)
    fig.text(0.02, 0.955, 'The numbers match the cane blueprint (cane_front_view.png). '
             'Quantities are the planned order from PARTS.md; check them against what arrived.',
             fontsize=10, color=INK2)
    for i, (num, draw, name, qty, job, where, group) in enumerate(PARTS):
        r, c = divmod(i, cols)
        ax = fig.add_axes([0.02 + c * 0.163, 0.70 - r * 0.228, 0.152, 0.215])
        ax.set_xlim(0, 10); ax.set_ylim(-3.6, 10); ax.axis('off')
        col = GROUP_COLOR[group]
        ax.add_patch(FancyBboxPatch((0.05, -3.5), 9.9, 13.4, boxstyle='round,pad=0,rounding_size=0.4', fc='white',
                                    ec=col, lw=1.8, zorder=0))
        ax.add_patch(Circle((0.95, 9.0), 0.7, fc=col, ec='none', zorder=6))
        ax.text(0.95, 9.0, str(num), ha='center', va='center', fontsize=9, fontweight='bold', color='white', zorder=7)
        ax.text(1.9, 9.0, name, fontsize=8.6, fontweight='bold', va='center', color=INK, zorder=7)
        draw(ax)
        ax.text(0.5, 0.6, f'Qty: {qty}', fontsize=8, fontweight='bold', color=col)
        ax.text(0.5, -0.6, job, fontsize=7.2, color=INK, wrap=True)
        ax.text(0.5, -1.8, f'Goes: {where}', fontsize=7.2, color=INK2, style='italic')
        ax.text(9.6, -3.1, group, fontsize=6.3, color=col, ha='right')
    fig.savefig(os.path.join(HERE, 'parts_overview.png'), dpi=150)
    plt.close(fig)


# ─────────────────────────────── cane front view (blueprint style) ───────────────────────────────
def tag(ax, x, y, num, r=5.2, fs=8.5, color='#ffd166'):
    ax.add_patch(Circle((x, y), r, fc=color, ec=BP_BG, lw=1.2, zorder=12))
    ax.text(x, y, str(num), ha='center', va='center', fontsize=fs, fontweight='bold', color=BP_BG, zorder=13)


def bp_axes(fig, rect, xlim, ylim, step):
    ax = fig.add_axes(rect)
    ax.set_facecolor(BP_BG)
    ax.set_aspect('equal')
    ax.set_xlim(*xlim); ax.set_ylim(*ylim); ax.axis('off')
    for gx in range(int(xlim[0]) // step * step, int(xlim[1]) + 1, step):
        ax.plot([gx, gx], ylim, color='#1d4a7a', lw=0.5, zorder=0)
    for gy in range(int(ylim[0]) // step * step, int(ylim[1]) + 1, step):
        ax.plot(xlim, [gy, gy], color='#1d4a7a', lw=0.5, zorder=0)
    return ax


def draw_ultrasonic(ax, x0, y0, see_through):
    """RCWL-1601 (45 x 20 board) on its wedge, on top of the lid."""
    a = 0.35 if see_through else 1.0
    ax.add_patch(Rectangle((x0 - 1.5, y0 - 2), 48, 24, fc='#c8a46a', ec=BP_LINE, lw=1, zorder=9, alpha=a * 0.8))
    ax.add_patch(Rectangle((x0, y0), 45, 20, fc=BLUE_PCB, ec=BP_LINE, lw=1.4, zorder=10, alpha=a))
    for xx in (9.5, 35.5):
        ax.add_patch(Circle((x0 + xx, y0 + 10), 8, fc=SILVER, ec='#dddddd', lw=1.2, zorder=11, alpha=a))
        ax.add_patch(Circle((x0 + xx, y0 + 10), 5.5, fc='#7d8590', ec='#dddddd', lw=0.8, zorder=11, alpha=a))


def draw_box(ax, detail):
    """The 90 x 158 box seen from the front: tip end at y=0, grip end at the top."""
    ax.add_patch(FancyBboxPatch((0, 0), 90, 158, boxstyle='round,pad=0,rounding_size=5', fc='#163f6b',
                                ec=BP_LINE, lw=2.2, zorder=5))
    # top wall: switch, USB-C, cable hole; bottom wall: laser window
    ax.add_patch(Rectangle((8, 156.5), 9, 6, fc='#333', ec=BP_LINE, lw=1, zorder=9))
    ax.add_patch(Rectangle((11, 162.5), 3, 3.5, fc='#999', ec=BP_LINE, lw=0.8, zorder=9))
    ax.add_patch(Rectangle((27.5, 156.5), 6, 4.5, fc='#999', ec=BP_LINE, lw=1, zorder=9))
    ax.add_patch(Circle((81, 158), 3, fc=BP_BG, ec=BP_LINE, lw=1.2, zorder=9))
    ax.add_patch(Rectangle((40, -2.5), 10, 4, fc='#c77dff', ec=BP_LINE, lw=1, zorder=9))
    if not detail:
        draw_ultrasonic(ax, 22.5, 8, see_through=False)
        return

    def inside(x, y, w, h, label=None, color=BP_LINE, fs=8):
        ax.add_patch(Rectangle((x, y), w, h, fc='none', ec=color, lw=1.4, ls=(0, (4, 2)), zorder=7))
        if label:
            ax.text(x + w / 2, y + h / 2, label, ha='center', va='center', fontsize=fs, color=color, zorder=8)

    # hose clamps: behind the box, around the shaft
    for y in (30, 130):
        ax.add_patch(Rectangle((32, y - 5), 26, 10, fc='none', ec='#ffd166', lw=1.2, ls=(0, (3, 2)), zorder=6))
    inside(5, 5, 80, 69, color='#e9c46a')
    inside(44, 75, 40, 77, '2 × 18650\nholder', fs=9)
    for xx in (48, 66):
        ax.add_patch(FancyBboxPatch((xx, 79), 14, 69, boxstyle='round,pad=0,rounding_size=6', fc='none',
                                    ec='#7fd1c5', lw=1.1, ls=(0, (2, 2)), zorder=7))
    inside(22, 128.5, 17, 26, 'TP4056')
    inside(22, 88, 17, 36, 'MT3608\n5.0 V')
    inside(30, 40, 52, 28, 'ESP32', fs=9)
    for yy in (40.5, 65.5):     # female headers under the ESP32
        ax.add_patch(Rectangle((32, yy), 48, 2, fc='none', ec='#e9c46a', lw=1, zorder=7))
    inside(60, 13, 16, 21, 'MPU\n6050', fs=7)
    ax.add_patch(Circle((14, 66), 6, fc='none', ec=BP_LINE, lw=1.4, ls=(0, (3, 2)), zorder=7))
    ax.add_patch(Circle((14, 66), 1.5, fc=BP_BG, ec='#ffd166', lw=1.2, zorder=8))   # 3 mm hole in the lid
    inside(10, 22, 6, 12)                     # transistors Q1 Q2
    inside(8, 8, 10, 10)                      # resistors + diodes
    inside(41.5, 2, 7, 6, color='#c77dff')    # VL53L0X behind the window
    draw_ultrasonic(ax, 22.5, 8, see_through=True)
    ax.add_patch(Circle((74, 18), 3, fc=BP_BG, ec=BP_LINE, lw=1, zorder=10))    # ultrasonic wire hole


def cane_front_view():
    fig = plt.figure(figsize=(26, 15.5))
    fig.patch.set_facecolor(BP_BG)
    fig.text(0.015, 0.975, 'GuideAI SMART CANE — FRONT VIEW BLUEPRINT', fontsize=22, fontweight='bold',
             color=BP_LINE, va='top')
    fig.text(0.015, 0.94, 'Looking straight at the cane. Units: mm. Numbers match parts_overview.png. '
             'Detail A: the box lid is see-through, dashed = inside the box.', fontsize=11.5, color='#a9c7e8',
             va='top')

    # ── left: the whole cane ──
    ov = bp_axes(fig, [0.01, 0.02, 0.19, 0.89], (-95, 185), (-240, 455), 25)
    cx, sw, gw, g0, g1 = 45, 14, 26, 205, 435
    ov.add_patch(Rectangle((cx - sw / 2, -150), sw, g0 + 150, fc='#f8f9fa', ec='#9aa0a6', lw=1, zorder=2))
    ov.add_patch(Rectangle((cx - sw / 2, -228), sw, 78, fc='#f8f9fa', ec='#9aa0a6', lw=1, zorder=2))
    ov.add_patch(Rectangle((cx - sw / 2, -228), sw, 45, fc='#d62828', ec='#9aa0a6', lw=1, zorder=3))
    ov.add_patch(Circle((cx, -231), 8, fc='#444', ec='#222', zorder=4))
    ov.add_patch(Rectangle((cx - sw / 2 - 1, -154), sw + 2, 8, fc=BP_BG, ec='none', zorder=3))
    for yb in (-146, -154):
        ov.plot([cx - 14, cx - 4, cx + 4, cx + 14], [yb, yb + 5, yb - 5, yb], color=BP_LINE, lw=1.4, zorder=4)
    ov.text(cx + 20, -150, '≈ 600 mm of\nshaft not drawn', fontsize=8.5, color='#a9c7e8', va='center')
    ov.text(cx + 20, -222, 'tip', fontsize=9, color='#a9c7e8', va='center')
    rr(ov, cx - gw / 2, g0, gw, g1 - g0, '#2b2b2b', ec='#111', r=8, z=2)
    for y in range(g0 + 12, g1 - 8, 14):
        ov.plot([cx - gw / 2 + 2, cx + gw / 2 - 2], [y, y], color='#444', lw=1, zorder=3)
    for y, col in ((395, '#d62828'), (360, '#e9ecef')):
        ov.add_patch(Circle((cx, y), 8, fc=SILVER, ec='#333', lw=1.2, zorder=6))
        ov.add_patch(Circle((cx, y), 5.5, fc=col, ec='#333', lw=0.8, zorder=7))
    ov.text(cx - 14, 395, 'SOS', ha='right', va='center', fontsize=9, color=BP_LINE, fontweight='bold')
    ov.text(cx - 14, 360, 'MODE', ha='right', va='center', fontsize=9, color=BP_LINE, fontweight='bold')
    tag(ov, cx + 24, 378, 10)
    ov.add_patch(Circle((cx, 300), 5, fc='none', ec='#ff70a6', lw=1.5, ls=(0, (2, 1.5)), zorder=6))
    ov.text(cx - 14, 300, 'motor inside\nunder palm', ha='right', va='center', fontsize=8.5, color='#ff70a6')
    tag(ov, cx + 24, 300, 11)
    ov.plot([81, 81, cx + 9, cx + 9], [158, 182, 194, g0 + 6], color='#ffd166', lw=1.6, ls=(0, (5, 2)), zorder=6)
    ov.text(92, 180, '6-wire cable', fontsize=8.5, color='#ffd166', va='center')
    draw_box(ov, detail=False)
    tag(ov, 112, 18, 2)
    tag(ov, 64, -14, 3)
    tag(ov, 112, 90, 20)
    ov.add_patch(Rectangle((-12, -24), 114, 216, fc='none', ec='#ff9f1c', lw=2, ls=(0, (6, 3)), zorder=8))
    ov.text(-12, 196, 'A', fontsize=16, fontweight='bold', color='#ff9f1c', va='bottom')
    ov.text(-90, 80, 'box bottom\n≈ 780 mm\nfrom the tip', fontsize=8.5, color='#a9c7e8', va='center')
    ov.text(-90, 320, 'grip\n≈ 230 mm', fontsize=8.5, color='#a9c7e8', va='center')

    # ── middle: detail A, the box ──
    dt = bp_axes(fig, [0.20, 0.02, 0.54, 0.89], (-85, 175), (-48, 200), 10)
    dt.text(-83, 197, 'DETAIL A — electronics box (158 × 90 mm), lid see-through', fontsize=14,
            fontweight='bold', color='#ff9f1c', va='top')
    dt.add_patch(Rectangle((38, -48), 14, 248, fc='#f8f9fa', ec='#9aa0a6', lw=1, zorder=1, alpha=0.45))
    dt.text(53, -44, 'cane shaft (behind)', fontsize=8.5, color='#a9c7e8')
    draw_box(dt, detail=True)

    def call(num, px, py, side, ly, text):
        lx = -14 if side == 'L' else 104
        dt.plot([px, lx + (5.2 if side == 'L' else -5.2)], [py, ly], color='#ffd166', lw=1, zorder=11)
        dt.plot(px, py, 'o', ms=3.5, color='#ffd166', zorder=11)
        tag(dt, lx, ly, num)
        dt.text(lx - 8 if side == 'L' else lx + 8, ly, text, ha='right' if side == 'L' else 'left', va='center',
                fontsize=9.5, color=BP_LINE, zorder=12)

    call(9, 12.5, 160, 'L', 180, 'ON/OFF switch (top wall)')
    call(5, 30, 158, 'L', 160, 'TP4056 charger,\nUSB-C hole in the top wall')
    call(21, 32, 130, 'L', 136, 'hose clamp (behind the box,\naround the shaft)')
    call(6, 22, 106, 'L', 110, 'MT3608 boost\n(set to 5.0 V first!)')
    call(12, 9, 68, 'L', 74, 'buzzer, under a\n3 mm hole in the lid')
    call(13, 10, 28, 'L', 46, 'S8050 transistors ×2')
    call(15, 8, 15, 'L', 26, 'resistors 1k, 10k, 100k')
    call(14, 9, 10, 'L', 6, 'diodes (stripe to 3.3 V)')
    call(3, 45, -1, 'L', -22, 'VL53L0X laser behind a window\nin the BOTTOM wall (aims at\nthe ground ahead of the tip)')
    call('C', 81, 158, 'R', 182, 'cable hole → grip\n(motor + buttons)')
    call(8, 84, 140, 'R', 160, '2 × 18650 holder\n(PARALLEL: 3.0–4.2 V)')
    call(20, 90, 122, 'R', 136, 'ABS box 158 × 90')
    call(7, 73, 100, 'R', 112, '18650 batteries ×2')
    call(17, 85, 72, 'R', 88, 'perfboard (lower half)')
    call(1, 82, 56, 'R', 66, 'ESP32 DevKit')
    call(16, 80, 42, 'R', 48, 'female headers\n(ESP32 plugs in)')
    call(4, 76, 26, 'R', 28, 'MPU6050, glued flat')
    call(2, 67, 12, 'R', 4, 'RCWL-1601 ON the lid,\non a ~20° wedge\n(looks forward)')
    dt.annotate('', xy=(0, -34), xytext=(90, -34), arrowprops=dict(arrowstyle='<->', color='#a9c7e8', lw=1))
    dt.text(45, -37, '90 mm', ha='center', va='top', fontsize=9, color='#a9c7e8')

    # ── right: key ──
    kx = fig.add_axes([0.75, 0.02, 0.245, 0.89]); kx.axis('off'); kx.set_xlim(0, 10); kx.set_ylim(0, 100)
    kx.text(0, 99, 'PARTS ON THE CANE', fontsize=13, fontweight='bold', color=BP_LINE, va='top')
    on_cane = [p for p in PARTS if p[0] not in (18, 19, 22, 23, 24)]
    for i, (num, _, name, _, _, where, _) in enumerate(on_cane):
        y = 94 - i * 3.75
        kx.add_patch(Ellipse((0.35, y), 0.62, 2.3, fc='#ffd166', ec='none'))
        kx.text(0.35, y, str(num), ha='center', va='center', fontsize=8, fontweight='bold', color=BP_BG)
        kx.text(0.9, y + 0.6, name, fontsize=9.5, fontweight='bold', color=BP_LINE, va='center')
        kx.text(0.9, y - 1.0, where, fontsize=8, color='#a9c7e8', va='center')
    kx.text(0, 94 - len(on_cane) * 3.75 + 0.5,
            'C = cable hole. Not on the cane: 18 breadboard, 19 jumper\nwires (testing), '
            '23 soldering iron, 24 multimeter (tools).', fontsize=8.5, color='#a9c7e8', va='top')
    kx.text(0, 14, 'FROM THE SIDE (cane_layout.png):\n'
            '• box on the FRONT of the shaft, lid facing forward\n'
            '• ultrasonic (2) on a ~20° wedge → forward, slightly up\n'
            '• laser (3) in the bottom wall → ground ~15 cm\n   ahead of the tip\n'
            '• USB-C (5), switch (9), cable hole on the TOP wall', fontsize=9, color=BP_LINE, va='top',
            bbox=dict(boxstyle='round,pad=0.5', fc='#163f6b', ec='#a9c7e8', lw=1))
    fig.savefig(os.path.join(HERE, 'cane_front_view.png'), dpi=130, facecolor=BP_BG)
    plt.close(fig)


if __name__ == '__main__':
    parts_overview()
    cane_front_view()
    print('wrote hardware/parts_overview.png and hardware/cane_front_view.png')
