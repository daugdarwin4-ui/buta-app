"""
Physical layout of the GuideAI smart cane, drawn from the parts that were ordered:
  hardware/cane_layout.png  — side view of the cane in use: where each part is mounted, where sensors point
  hardware/box_layout.png   — inside the 158 x 90 mm project box, to scale, plus the holes to cut
Run:  model\\train-venv\\Scripts\\python.exe hardware\\make_cane_layout.py
Sizes are typical module sizes (mm); measure yours and adjust if a board differs.
"""
import math
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle, Wedge

HERE = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({'font.family': 'DejaVu Sans'})
INK, INK2 = '#1f2328', '#57606a'
PCB_BLUE, PCB_BLACK, PCB_PURPLE = '#1b4f9c', '#222222', '#6a2c91'
SILVER = '#c0c4c8'


# ─────────────────────────────── CANE SIDE VIEW ───────────────────────────────
def cane_layout():
    fig, ax = plt.subplots(figsize=(16, 11))
    ax.set_aspect('equal')
    ax.set_xlim(-95, 175); ax.set_ylim(-14, 182); ax.axis('off')
    ax.text(-93, 180, 'GuideAI smart cane — where each part goes (side view, in use)', fontsize=15,
            fontweight='bold', color=INK, va='top')
    ax.text(-93, 173, 'Sizes in cm. Cane about 120 cm long, held at about 35° so the tip touches the ground ahead.',
            fontsize=9, color=INK2, va='top')

    # Ground
    ax.add_patch(Rectangle((-95, -14), 270, 14, fc='#e9e6df', ec='none'))
    ax.plot([-95, 175], [0, 0], color='#8a8478', lw=2)
    ax.text(-90, -8, 'ground', fontsize=9, color=INK2)

    # Cane geometry: tip at (0, 0), 120 cm long, 35° from vertical
    L, ang = 120, math.radians(35)
    u = (math.sin(ang), math.cos(ang))          # along the cane, tip → handle
    n = (-u[1], u[0])                           # perpendicular, pointing "forward/up"

    def at(s, off=0.0):
        return (u[0] * s + n[0] * off, u[1] * s + n[1] * off)

    # Shaft (white with red tip band, as a real white cane)
    def band(s0, s1, color, width=2.4):
        p = [at(s0, -width / 2), at(s1, -width / 2), at(s1, width / 2), at(s0, width / 2)]
        ax.add_patch(Polygon(p, closed=True, fc=color, ec='#9aa0a6', lw=0.8, zorder=3))
    band(0, 18, '#d62828')
    band(18, 96, '#ffffff')
    band(96, 120, '#2b2b2b', 3.6)                # rubber grip
    ax.add_patch(Circle(at(0), 1.6, fc='#444', ec='#222', zorder=4))   # tip

    # Person (simple silhouette) holding the grip
    hand = at(108, -1.0)
    ax.add_patch(Circle((112, 160), 9, fc='#d9dde1', ec='#8c959f', lw=1.5, zorder=1))
    ax.plot([112, 112], [151, 92], color='#8c959f', lw=7, solid_capstyle='round', zorder=1)
    ax.plot([112, 100, 112, 124], [92, 0, 92, 0], color='#8c959f', lw=7, solid_capstyle='round', zorder=1)
    ax.plot([112, 95, hand[0]], [140, 112, hand[1]], color='#8c959f', lw=6, solid_capstyle='round', zorder=5)
    ax.text(126, 150, 'user', fontsize=9, color=INK2)

    # ── Electronics box on the shaft, just below the grip ──
    s_box0, s_box1, depth = 78, 93.8, 9.0       # 158 mm along the shaft, about 9 cm deep including the lid
    box = [at(s_box0, 1.2), at(s_box1, 1.2), at(s_box1, 1.2 + depth), at(s_box0, 1.2 + depth)]
    ax.add_patch(Polygon(box, closed=True, fc='#f2f2f2', ec=INK, lw=1.8, zorder=6))
    # hose clamps
    for s in (81, 91):
        c = [at(s - 0.6, -1.6), at(s + 0.6, -1.6), at(s + 0.6, 2.2), at(s - 0.6, 2.2)]
        ax.add_patch(Polygon(c, closed=True, fc=SILVER, ec='#6e7781', lw=0.8, zorder=7))

    # Ultrasonic on TOP of the lid (the lid faces forward and 35° up because the cane is tilted),
    # on a ~20° wedge so it looks forward and only slightly up
    lid = 1.2 + depth
    w0, w1, w2 = at(s_box0 + 2.0, lid), at(s_box0 + 8.0, lid), at(s_box0 + 8.0, lid + 2.4)
    ax.add_patch(Polygon([w0, w1, w2], closed=True, fc='#c8a46a', ec=INK, lw=1, zorder=8))   # wedge
    beam_dir = (-math.cos(math.radians(15)), math.sin(math.radians(15)))                     # forward, 15° up
    face = (-beam_dir[1], beam_dir[0])
    us_c = ((w0[0] + w2[0]) / 2 - 0.6, (w0[1] + w2[1]) / 2 + 0.9)
    board = [(us_c[0] + face[0] * 2.3, us_c[1] + face[1] * 2.3), (us_c[0] - face[0] * 2.3, us_c[1] - face[1] * 2.3),
             (us_c[0] - face[0] * 2.3 - beam_dir[0] * 1.2, us_c[1] - face[1] * 2.3 - beam_dir[1] * 1.2),
             (us_c[0] + face[0] * 2.3 - beam_dir[0] * 1.2, us_c[1] + face[1] * 2.3 - beam_dir[1] * 1.2)]
    ax.add_patch(Polygon(board, closed=True, fc=PCB_BLUE, ec=INK, lw=1, zorder=9))
    for k in (-1.1, 1.1):
        ax.add_patch(Circle((us_c[0] + face[0] * k + beam_dir[0] * 0.8, us_c[1] + face[1] * k + beam_dir[1] * 0.8),
                            0.95, fc=SILVER, ec='#555', lw=0.8, zorder=10))
    origin = (us_c[0] + beam_dir[0] * 1.6, us_c[1] + beam_dir[1] * 1.6)
    ax.add_patch(Wedge(origin, 62, 165 - 15 + 15 - 12, 165 + 12 - 15 + 15, fc='#3a86ff', alpha=0.13, ec='none',
                       zorder=2))
    ax.annotate('', xy=(origin[0] + beam_dir[0] * 58, origin[1] + beam_dir[1] * 58), xytext=origin,
                arrowprops=dict(arrowstyle='-|>', color='#3a86ff', lw=1.8), zorder=3)

    # VL53L0X on the lower end of the box: that end already points down at the ground, tilt it a little
    # further forward so it looks just ahead of the tip
    vl = at(s_box0 - 0.2, 1.2 + depth * 0.3)
    ax.add_patch(Rectangle((vl[0] - 1.6, vl[1] - 1.0), 2.2, 1.6, fc=PCB_PURPLE, ec=INK, lw=1, zorder=9))
    ground_pt = (-15, 0)
    ax.plot([vl[0] - 1, ground_pt[0]], [vl[1] - 0.6, ground_pt[1]], color='#b08900', lw=1.8, ls='--', zorder=2)
    ax.add_patch(Circle(ground_pt, 1.4, fc='#b08900', ec='none', zorder=3))
    dist = math.hypot(vl[0] - ground_pt[0], vl[1] - ground_pt[1])

    # Buttons on top of the grip (thumb side) and motor inside the grip (palm side)
    for s, col in ((114, '#d62828'), (110.5, '#c0c4c8')):
        ax.add_patch(Circle(at(s, 2.6), 1.15, fc=col, ec='#333', lw=1.2, zorder=8))
    ax.add_patch(Circle(at(102, -2.2), 0.9, fc=SILVER, ec='#333', lw=1, zorder=8))
    # cable from box up to the grip, along the shaft
    c0, c1 = at(s_box1, 2.0), at(110, 2.0)
    ax.plot([c0[0], c1[0]], [c0[1], c1[1]], color='#555', lw=1.6, ls=(0, (4, 2)), zorder=7)

    # ── Callouts ──
    def callout(xy, txt, tx, ty, color=INK):
        ax.annotate(txt, xy=xy, xytext=(tx, ty), fontsize=8.6, color=INK, va='center',
                    bbox=dict(boxstyle='round,pad=0.35', fc='white', ec=color, lw=1.2),
                    arrowprops=dict(arrowstyle='-', color=color, lw=1.2), zorder=10)

    callout(at(114, 2.6), 'SOS button (red, 16 mm metal)\nand MODE button: on top of the\ngrip where the thumb rests',
            -2, 148, '#d62828')
    callout(at(102, -2.2), 'Vibration motor (10 mm coin):\nglued inside the grip,\nunder the palm', 128, 120, '#ff006e')
    callout(at(100, 2.0), 'Cable to the grip: 6 thin wires\n(motor 2, buttons 3, GND) along\nthe shaft, held with heat-shrink\nor cable ties', 128, 99, INK2)
    callout(at(86, 1.2 + depth), 'Electronics box 158 × 90 mm\n(ESP32, batteries, charger, MPU6050,\nbuzzer, switch): just below the grip,\nheld by 2 hose clamps', 128, 76, INK)
    callout(us_c, 'RCWL-1601 ultrasonic: ON TOP of the lid,\non a ~20° wedge so it points FORWARD and\nslightly UP → branches, signboards, mirrors\nat chest/head height (warns ≤ 150 cm)',
            -93, 118, '#3a86ff')
    callout(vl, f'VL53L0X laser: lower end of the box (this end\nalready faces the ground), tilted a little forward\n→ hits the ground ~15 cm ahead of the tip\n(about {dist:.0f} cm away) → holes, canals,\nstairs going down, curbs',
            -93, 62, '#b08900')
    callout(ground_pt, 'where the laser hits the ground', -93, 18, '#b08900')

    ax.text(-93, -11, 'Weight tip: keep the box close to the grip, so the cane still feels light at the tip.',
            fontsize=8.5, color=INK2)
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, 'cane_layout.png'), dpi=160)
    plt.close(fig)


# ─────────────────────────────── INSIDE THE BOX ───────────────────────────────
def module(ax, x, y, w, h, color, label, sub='', text_color='white', size=7.5):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0,rounding_size=1.5', fc=color, ec=INK, lw=1.2,
                                zorder=4))
    ax.text(x + w / 2, y + h / 2 + (2.5 if sub else 0), label, ha='center', va='center', fontsize=size,
            fontweight='bold', color=text_color, zorder=6)
    if sub:
        ax.text(x + w / 2, y + h / 2 - 3.2, sub, ha='center', va='center', fontsize=6.3, color=text_color, zorder=6)


def box_layout():
    fig, axes = plt.subplots(1, 2, figsize=(17, 8.6), gridspec_kw={'width_ratios': [1.55, 1]})
    ax = axes[0]
    ax.set_aspect('equal'); ax.set_xlim(-20, 182); ax.set_ylim(-34, 108); ax.axis('off')
    ax.text(-18, 106, 'Inside the box — top view, lid off (to scale, mm)', fontsize=13, fontweight='bold',
            color=INK, va='top')

    # Box: 158 x 90 outside, 3 mm walls
    ax.add_patch(FancyBboxPatch((0, 0), 158, 90, boxstyle='round,pad=0,rounding_size=4', fc='#e6e6e6', ec=INK, lw=2))
    ax.add_patch(Rectangle((3, 3), 152, 84, fc='#fafafa', ec='#9aa0a6', lw=1))
    ax.text(79, -6, '158 mm', ha='center', fontsize=8, color=INK2)
    ax.text(-6, 45, '90 mm', ha='center', va='center', rotation=90, fontsize=8, color=INK2)
    ax.text(-16, 98, '← GRIP END: USB-C charging, ON/OFF switch,\n    cable to the buttons and motor', fontsize=7.5,
            color=INK2, va='top')
    ax.text(178, 98, 'TIP END →\nlaser window in this wall;\nultrasonic on the lid above', fontsize=7.5,
            color=INK2, va='top', ha='right')
    ax.text(79, -14, 'The long side (158 mm) runs ALONG the cane shaft.', ha='center', fontsize=7.5, color=INK2)

    # 2 x 18650 holder 77 x 40
    module(ax, 6, 44, 77, 40, '#2b2b2b', '')
    for dy in (54, 74):
        ax.add_patch(FancyBboxPatch((10, dy - 7), 68, 14, boxstyle='round,pad=0,rounding_size=6', fc='#2a9d8f',
                                    ec='#1d6b62', lw=1, zorder=5))
        ax.text(44, dy, '18650 3.7 V', ha='center', va='center', fontsize=6.5, color='white', zorder=6,
                fontweight='bold')
    ax.text(44.5, 64, '2 × 18650 holder (parallel) · 77 × 40 mm', ha='center', va='center', fontsize=6,
            color='white', zorder=6)
    # TP4056 26 x 17 at the left wall, USB-C facing out
    module(ax, 3.5, 22, 26, 17, PCB_BLUE, 'TP4056', 'USB-C →|wall')
    ax.add_patch(Rectangle((-1.5, 27.5), 5, 6, fc='#9aa0a6', ec=INK, lw=1, zorder=7))
    # MT3608 36 x 17
    module(ax, 34, 22, 36, 17, PCB_BLUE, 'MT3608', 'set 5.0 V')
    ax.add_patch(Rectangle((63, 23.5), 5, 5, fc='#4cc9f0', ec=INK, lw=0.8, zorder=6))
    ax.text(65.5, 20.5, 'screw', ha='center', fontsize=5.8, color=INK2, va='top')
    # Slide switch on the left wall
    ax.add_patch(Rectangle((-2.5, 8), 6, 9, fc='#333', ec=INK, lw=1, zorder=7))
    ax.add_patch(Rectangle((-5.5, 10.5), 3, 4, fc='#777', ec=INK, lw=0.8, zorder=8))
    ax.text(5, 12.5, 'ON/OFF switch\n(through the wall)', fontsize=6.5, color=INK, va='center')

    # Perfboard 70 x 80 with the ESP32, transistors, MPU6050, buzzer
    ax.add_patch(Rectangle((84, 5), 69, 80, fc='#d8b46a', ec='#8c6d2c', lw=1.2, zorder=3))
    for gx in range(87, 152, 3):
        for gy in range(8, 84, 3):
            ax.plot(gx, gy, '.', ms=1, color='#a07b33', zorder=3.5)
    ax.text(118.5, 2, 'perfboard (7 × 9 cm cut to ~70 × 80)', ha='center', fontsize=6.8, color=INK2, va='top',
            bbox=dict(fc='#fafafa', ec='none', pad=0.5), zorder=7)
    module(ax, 90, 30, 28, 52, PCB_BLACK, 'ESP32', 'DevKit V1\n52 × 28')
    ax.add_patch(Rectangle((96, 66), 16, 12, fc=SILVER, ec='#666', lw=0.8, zorder=5))   # metal shield
    ax.add_patch(Rectangle((99.5, 26.5), 9, 4, fc='#9aa0a6', ec=INK, lw=0.8, zorder=6))  # micro-USB
    ax.text(104, 21, 'ESP32 USB (for code):\nreach it with the lid off', ha='center', fontsize=6, color=INK2,
            bbox=dict(fc='white', ec='none', pad=0.5), zorder=7)
    module(ax, 124, 60, 21, 16, PCB_BLUE, 'MPU6050', 'flat, glued')
    ax.add_patch(Circle((134, 44), 6, fc='#1d1d1d', ec=INK, lw=1, zorder=4))
    ax.text(134, 44, 'buzzer', ha='center', va='center', fontsize=6, color='white', zorder=6)
    for i, (x, lab) in enumerate(((124, 'Q1'), (131, 'Q2'))):
        ax.add_patch(Rectangle((x, 12), 4, 5, fc='#333', ec=INK, lw=0.8, zorder=5))
        ax.text(x + 2, 9.5, lab, ha='center', fontsize=6, color=INK, va='top')
    ax.add_patch(Rectangle((140, 11), 10, 7, fc='#e9ecef', ec=INK, lw=0.8, zorder=5))
    ax.text(145, 14.5, 'R, D', ha='center', va='center', fontsize=6, color=INK, zorder=6)
    ax.text(137, 24, 'transistors, resistors,\ndiodes (Fig. 2)', ha='center', fontsize=6, color=INK2,
            bbox=dict(fc='white', ec='none', pad=0.5), zorder=7)
    # cable exit to the grip (grip end wall)
    ax.add_patch(Circle((0, 87 - 6), 3, fc='#ffffff', ec=INK, lw=1.2, zorder=7))
    ax.text(-4, 72, 'cable\nhole', ha='right', fontsize=6.5, color=INK, va='center')
    # laser window (tip end wall)
    ax.add_patch(Rectangle((155.5, 40), 4, 10, fc='#ffffff', ec=INK, lw=1.2, zorder=7))
    ax.add_patch(Rectangle((149, 41.5), 5, 7, fc=PCB_PURPLE, ec=INK, lw=0.8, zorder=8))
    ax.text(161, 45, 'VL53L0X\nbehind\nwindow', fontsize=6.3, color=INK, va='center')

    # ── Right panel: the outside faces to cut ──
    ax2 = axes[1]
    ax2.set_aspect('equal'); ax2.set_xlim(-10, 130); ax2.set_ylim(-20, 170); ax2.axis('off')
    ax2.text(-8, 168, 'Holes to cut in the box', fontsize=13, fontweight='bold', color=INK, va='top')

    # Lid (158 x 90): ultrasonic on a wedge near the tip end, wire hole, buzzer hole
    ax2.add_patch(FancyBboxPatch((-6, 112), 126, 44, boxstyle='round,pad=0,rounding_size=4', fc='#e6e6e6', ec=INK,
                                 lw=1.8))
    ax2.text(57, 159, 'Lid (158 × 90 mm, drawn smaller)', ha='center', fontsize=9, fontweight='bold', color=INK)
    ax2.add_patch(Polygon([[116, 122], [88, 122], [88, 146]], closed=True, fc='#c8a46a', ec=INK, lw=1.2))
    ax2.add_patch(Rectangle((88, 126), 22, 12, fc=PCB_BLUE, ec=INK, lw=1))
    for cy in (129, 135):
        ax2.add_patch(Circle((111.5, cy), 2.6, fc=SILVER, ec='#555', lw=0.8))
    ax2.text(100, 117, 'RCWL-1601 on a ~20° wedge\n(eyes face the tip end)', ha='center', fontsize=6.8, color=INK,
             va='top')
    ax2.add_patch(Circle((80, 130), 2.2, fc='white', ec=INK, lw=1.3))
    ax2.text(76, 130, 'its 4 wires: 6 mm hole', fontsize=6.8, color=INK, va='center', ha='right')
    ax2.add_patch(Circle((28, 138), 1.2, fc='white', ec=INK, lw=1.3))
    ax2.text(28, 133, '3 mm hole\nover buzzer', ha='center', fontsize=6.8, color=INK, va='top')
    ax2.text(118, 152, 'TIP END →', fontsize=7, color=INK2, ha='right')
    ax2.text(-4, 152, '← GRIP END', fontsize=7, color=INK2)

    # End face toward the tip (90 wide x ~60 deep): laser window only
    ax2.add_patch(FancyBboxPatch((10, 74), 90, 30, boxstyle='round,pad=0,rounding_size=4', fc='#e6e6e6', ec=INK,
                                 lw=1.8))
    ax2.text(55, 106, 'End wall toward the tip (90 × 60 mm, drawn shorter)', ha='center', fontsize=9,
             fontweight='bold', color=INK)
    ax2.add_patch(Rectangle((50, 82), 10, 6, fc='white', ec=INK, lw=1.4))
    ax2.text(55, 79.5, 'VL53L0X window ~10 × 6 mm: sensor behind it, tilted\na little forward; keep the window clean',
             ha='center', fontsize=6.8, color=INK, va='top')

    # End wall toward the grip: USB-C, switch, cable hole
    ax2.add_patch(FancyBboxPatch((10, 20), 90, 45, boxstyle='round,pad=0,rounding_size=4', fc='#e6e6e6', ec=INK,
                                 lw=1.8))
    ax2.text(55, 68, 'End wall toward the grip (90 × 60 mm)', ha='center', fontsize=9, fontweight='bold',
             color=INK)
    ax2.add_patch(Circle((88, 55), 3, fc='white', ec=INK, lw=1.4))
    ax2.text(88, 49.5, '6 mm: cable\nto the grip', ha='center', fontsize=7, color=INK, va='top')
    ax2.add_patch(FancyBboxPatch((26, 38), 12, 6, boxstyle='round,pad=0,rounding_size=2.5', fc='white', ec=INK,
                                 lw=1.4))
    ax2.text(32, 33, 'USB-C\n(charge)', ha='center', fontsize=7, color=INK, va='top')
    ax2.add_patch(Rectangle((62, 37.5), 10, 7, fc='white', ec=INK, lw=1.4))
    ax2.add_patch(Rectangle((65, 39), 3, 4, fc='#777', ec=INK, lw=0.8))
    ax2.text(67, 33, 'ON/OFF\nswitch', ha='center', fontsize=7, color=INK, va='top')

    ax2.text(-8, 8, 'Tip: drill small pilot holes, then widen with a step drill or file.\n'
             'Wedge: cardboard, wood, foam or 3D print, glued to the lid.',
             fontsize=7.6, color=INK2, va='top')

    fig.tight_layout()
    fig.savefig(os.path.join(HERE, 'box_layout.png'), dpi=160)
    plt.close(fig)


if __name__ == '__main__':
    cane_layout()
    box_layout()
    print('wrote hardware/cane_layout.png and hardware/box_layout.png')
