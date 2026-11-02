"""
Draws the GuideAI smart cane wiring blueprint:
  hardware/wiring_diagram.png    — every module and how it connects to the ESP32
  hardware/driver_circuits.png   — close-up of the small circuits (motor, buzzer, buttons, battery level)
Run:  model\\train-venv\\Scripts\\python.exe hardware\\make_wiring_diagram.py
Pin choices are listed in hardware/WIRING.md (kept in sync with this file).
"""
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
plt.rcParams.update({'font.family': 'DejaVu Sans'})

# Wire colours (also used for real jumper wires where possible)
RED = '#d62828'      # battery / 5 V
ORANGE = '#f77f00'   # 3.3 V
BLACK = '#1d1d1d'    # GND
SDA = '#e9c46a'      # I2C data
SCL = '#2a9d8f'      # I2C clock
TRIG = '#3a86ff'     # ultrasonic trigger
ECHO = '#8338ec'     # ultrasonic echo
MOTOR = '#ff006e'
BUZZ = '#fb5607'
BTN = '#06d6a0'
INK, INK2 = '#1f2328', '#57606a'


def box(ax, x0, y0, x1, y1, title, fc='#ffffff', ec='#57606a', size=9):
    ax.add_patch(FancyBboxPatch((x0, y0), x1 - x0, y1 - y0, boxstyle='round,pad=0.02,rounding_size=0.15',
                                fc=fc, ec=ec, lw=1.6))
    ax.text((x0 + x1) / 2, y1 - 0.35, title, ha='center', va='top', fontsize=size, fontweight='bold', color=INK)


def pin(ax, x, y, label, side='left', color=INK):
    ax.plot(x, y, 'o', ms=5, color=color, zorder=5)
    if side == 'left':
        ax.text(x + 0.15, y, label, ha='left', va='center', fontsize=7.5, color=INK)
    elif side == 'right':
        ax.text(x - 0.15, y, label, ha='right', va='center', fontsize=7.5, color=INK)
    elif side == 'top':
        ax.text(x, y - 0.18, label, ha='center', va='top', fontsize=7, color=INK)
    else:
        ax.text(x, y + 0.18, label, ha='center', va='bottom', fontsize=7, color=INK)


def wire(ax, pts, color, lw=2.4):
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=color, lw=lw, solid_capstyle='round', solid_joinstyle='round', zorder=3)


def dot(ax, x, y, color):
    ax.plot(x, y, 'o', ms=6.5, color=color, zorder=6)


# ─────────────────────────────── MAIN DIAGRAM ───────────────────────────────
def main_diagram():
    fig, ax = plt.subplots(figsize=(17, 11.5))
    ax.set_xlim(-0.2, 33.2); ax.set_ylim(-0.6, 22.6); ax.axis('off')
    ax.text(0, 22.3, 'GuideAI smart cane — wiring blueprint (all parts you ordered)', fontsize=15,
            fontweight='bold', color=INK, va='top')

    # Power rails (like breadboard rails)
    wire(ax, [(8.0, 20.6), (30.4, 20.6)], ORANGE, 3.5)
    ax.text(8.0, 20.85, '3.3 V rail (from ESP32 3V3 pin)', fontsize=8, color=ORANGE, fontweight='bold')
    wire(ax, [(8.0, 19.9), (30.4, 19.9)], BLACK, 3.5)
    ax.text(21.5, 20.08, 'GND rail', fontsize=8, color=BLACK, fontweight='bold')
    wire(ax, [(6.6, 1.3), (30.4, 1.3)], ORANGE, 3.5)
    wire(ax, [(6.6, 0.5), (30.4, 0.5)], BLACK, 3.5)
    ax.text(24.0, 1.45, '3.3 V rail', fontsize=8, color=ORANGE, fontweight='bold')
    ax.text(24.0, 0.05, 'GND rail', fontsize=8, color=BLACK, fontweight='bold')
    wire(ax, [(28.4, 1.3), (28.4, 20.6)], ORANGE, 3)   # 3.3 V riser joins top and bottom rails
    wire(ax, [(29.4, 0.5), (29.4, 19.9)], BLACK, 3)    # GND riser
    dot(ax, 28.4, 20.6, ORANGE); dot(ax, 28.4, 1.3, ORANGE)
    dot(ax, 29.4, 19.9, BLACK); dot(ax, 29.4, 0.5, BLACK)

    # ── Power chain (left column) ──
    box(ax, 0.8, 15.6, 5.0, 18.8, '2 × 18650\nholder (PARALLEL)', fc='#fff1f1', ec=RED)
    pin(ax, 0.8, 17.0, '+', 'left', RED); pin(ax, 0.8, 16.2, '−', 'left', BLACK)
    box(ax, 0.8, 11.0, 5.0, 14.3, 'TP4056 USB-C\ncharger (with protection)', fc='#fff1f1', ec=RED, size=8)
    pin(ax, 0.8, 12.9, 'B+', 'left', RED); pin(ax, 0.8, 12.1, 'B−', 'left', BLACK)
    pin(ax, 5.0, 12.9, 'OUT+', 'right', RED); pin(ax, 5.0, 12.1, 'OUT−', 'right', BLACK)
    ax.text(2.9, 11.25, 'plug USB-C here to charge', ha='center', fontsize=6.8, color=INK2, style='italic')
    # Slide switch on OUT+
    ax.add_patch(FancyBboxPatch((5.55, 12.6), 1.0, 0.6, boxstyle='round,pad=0.02', fc='#ffffff', ec=INK, lw=1.4))
    ax.text(6.05, 12.9, 'ON/OFF', ha='center', va='center', fontsize=6.5, fontweight='bold')
    ax.text(6.05, 13.45, 'SS12D00G3', ha='center', fontsize=6.5, color=INK2)
    box(ax, 0.8, 5.4, 5.0, 8.6, 'MT3608 boost\nSET TO 5.0 V FIRST', fc='#fff1f1', ec=RED, size=8)
    pin(ax, 0.8, 7.0, 'VIN+', 'left', RED); pin(ax, 0.8, 6.2, 'VIN−', 'left', BLACK)
    pin(ax, 5.0, 7.0, 'VOUT+', 'right', RED); pin(ax, 5.0, 6.2, 'VOUT−', 'right', BLACK)

    wire(ax, [(0.8, 17.0), (0.35, 17.0), (0.35, 12.9), (0.8, 12.9)], RED)        # battery + → B+
    wire(ax, [(0.8, 16.2), (0.55, 16.2), (0.55, 12.1), (0.8, 12.1)], BLACK)      # battery − → B−
    wire(ax, [(5.0, 12.9), (5.55, 12.9)], RED)                                   # OUT+ → switch
    wire(ax, [(6.55, 12.9), (7.0, 12.9), (7.0, 9.0), (0.55, 9.0), (0.55, 7.0), (0.8, 7.0)], RED)  # switch → VIN+
    wire(ax, [(5.0, 12.1), (5.4, 12.1), (5.4, 9.5), (0.3, 9.5), (0.3, 6.2), (0.8, 6.2)], BLACK)  # OUT− → VIN−
    wire(ax, [(5.0, 7.0), (9.3, 7.0), (9.3, 16.8), (10.0, 16.8)], RED, 3)        # VOUT+ (5 V) → ESP32 VIN
    wire(ax, [(5.0, 6.2), (6.6, 6.2), (6.6, 0.5)], BLACK)                        # VOUT− → GND
    ax.text(9.45, 11.8, '5 V', fontsize=8, color=RED, fontweight='bold', rotation=90)

    # ── ESP32 ──
    box(ax, 10.0, 4.2, 16.0, 18.4, 'ESP32 DevKit V1\n(WROOM-32)', fc='#eef5ff', ec='#2a78d6', size=10)
    pin(ax, 10.0, 16.8, 'VIN (5 V in)', 'left', RED)
    pin(ax, 10.0, 15.9, 'GND', 'left', BLACK)
    pin(ax, 10.0, 13.0, 'GPIO34 battery level\n(optional, Fig. 2)', 'left', INK2)
    pin(ax, 16.0, 17.2, '3V3 (3.3 V out)', 'right', ORANGE)
    pin(ax, 16.0, 16.4, 'GND', 'right', BLACK)
    pin(ax, 16.0, 15.4, 'GPIO17 → TRIG', 'right', TRIG)
    pin(ax, 16.0, 14.6, 'GPIO16 ← ECHO', 'right', ECHO)
    pin(ax, 16.0, 11.4, 'GPIO21  SDA', 'right', SDA)
    pin(ax, 16.0, 10.4, 'GPIO22  SCL', 'right', SCL)
    ax.text(13.0, 8.6, 'Onboard LED = GPIO2\n(no wire needed)', ha='center', fontsize=7, color=INK2, style='italic')
    ax.text(13.0, 6.9, 'USB port: for uploading code.\nTurn the cane switch OFF\nwhile USB is plugged in.',
            ha='center', fontsize=7, color=RED)
    for x, label, color in ((10.8, 'G32', BTN), (11.8, 'G33', BTN), (13.2, 'G25', MOTOR), (14.6, 'G26', BUZZ)):
        pin(ax, x, 4.2, label, 'bottom', color)

    wire(ax, [(10.0, 15.9), (8.6, 15.9), (8.6, 19.9)], BLACK)                    # ESP32 GND → GND rail
    dot(ax, 8.6, 19.9, BLACK)
    wire(ax, [(16.0, 17.2), (17.4, 17.2), (17.4, 20.6)], ORANGE, 3)              # 3V3 → 3.3 V rail
    dot(ax, 17.4, 20.6, ORANGE)
    wire(ax, [(16.0, 16.4), (18.2, 16.4), (18.2, 19.9)], BLACK)                  # GND → GND rail
    dot(ax, 18.2, 19.9, BLACK)

    # ── Sensors (right column) ──
    box(ax, 21.0, 13.9, 26.4, 18.6, 'RCWL-1601\nultrasonic (front, chest height)', fc='#f3f0ff', ec=ECHO, size=8)
    pin(ax, 21.0, 15.4, 'Trig', 'left', TRIG); pin(ax, 21.0, 14.6, 'Echo', 'left', ECHO)
    pin(ax, 26.4, 17.6, 'VCC', 'right', ORANGE); pin(ax, 26.4, 16.8, 'GND', 'right', BLACK)
    wire(ax, [(16.0, 15.4), (21.0, 15.4)], TRIG)
    wire(ax, [(16.0, 14.6), (21.0, 14.6)], ECHO)

    box(ax, 21.0, 9.6, 26.4, 13.4, 'VL53L0X laser (ToF)\npoints DOWN at the ground', fc='#fdfbe9', ec='#b08900', size=8)
    pin(ax, 21.0, 11.4, 'SDA', 'left', SDA); pin(ax, 21.0, 10.4, 'SCL', 'left', SCL)
    pin(ax, 26.4, 12.4, 'VIN', 'right', ORANGE); pin(ax, 26.4, 11.6, 'GND', 'right', BLACK)
    ax.text(23.7, 9.85, 'XSHUT, GPIO1: leave empty', ha='center', fontsize=6.5, color=INK2, style='italic')

    box(ax, 21.0, 5.0, 26.4, 8.9, 'MPU6050 (GY-521)\nfall detection', fc='#eafaf7', ec=SCL, size=8)
    pin(ax, 21.0, 7.0, 'SDA', 'left', SDA); pin(ax, 21.0, 6.2, 'SCL', 'left', SCL)
    pin(ax, 26.4, 7.9, 'VCC', 'right', ORANGE); pin(ax, 26.4, 7.1, 'GND', 'right', BLACK)
    ax.text(23.7, 5.25, 'XDA, XCL, AD0, INT: leave empty', ha='center', fontsize=6.5, color=INK2, style='italic')

    # I2C bus: both sensors share SDA and SCL
    wire(ax, [(16.0, 11.4), (21.0, 11.4)], SDA)
    wire(ax, [(19.2, 11.4), (19.2, 7.0), (21.0, 7.0)], SDA); dot(ax, 19.2, 11.4, SDA)
    wire(ax, [(16.0, 10.4), (21.0, 10.4)], SCL)
    wire(ax, [(19.9, 10.4), (19.9, 6.2), (21.0, 6.2)], SCL); dot(ax, 19.9, 10.4, SCL)
    ax.text(19.55, 12.0, 'shared I2C bus', ha='center', fontsize=7, color=INK2)

    # Sensor power to the risers
    for y in (17.6, 12.4, 7.9):
        wire(ax, [(26.4, y), (28.4, y)], ORANGE); dot(ax, 28.4, y, ORANGE)
    for y in (16.8, 11.6, 7.1):
        wire(ax, [(26.4, y), (29.4, y)], BLACK); dot(ax, 29.4, y, BLACK)

    # ── Bottom row: buttons, motor, buzzer (details in Fig. 2) ──
    bottom = [
        (8.4, 10.6, 'SOS button\n(+10 kΩ to GND)', BTN, 10.8, 3.75),
        (10.9, 13.1, 'MODE button\n(+10 kΩ to GND)', BTN, 11.8, 3.55),
        (13.5, 17.6, 'Vibration motor\nS8050 + 1 kΩ + diode', MOTOR, 13.2, 3.55),
        (18.0, 22.1, 'Active buzzer 3.3 V\nS8050 + 1 kΩ', BUZZ, 14.6, 3.8),
    ]
    for x0, x1, title, color, px, level in bottom:
        box(ax, x0, 1.9, x1, 3.35, title, fc='#ffffff', ec=color, size=7.2)
        cx = (x0 + x1) / 2
        wire(ax, [(px, 4.2), (px, level), (cx, level), (cx, 3.35)], color)
        wire(ax, [(x0 + 0.4, 1.9), (x0 + 0.4, 1.3)], ORANGE); dot(ax, x0 + 0.4, 1.3, ORANGE)
        wire(ax, [(x1 - 0.4, 1.9), (x1 - 0.4, 0.5)], BLACK); dot(ax, x1 - 0.4, 0.5, BLACK)

    # ── Legend and warnings ──
    lx, ly = 30.9, 18.6
    ax.text(lx - 0.1, ly + 0.5, 'Wire colours', fontsize=9, fontweight='bold', color=INK)
    for i, (c, t) in enumerate(((RED, 'Battery / 5 V'), (ORANGE, '3.3 V'), (BLACK, 'GND'), (SDA, 'SDA (I2C data)'),
                                (SCL, 'SCL (I2C clock)'), (TRIG, 'Trig'), (ECHO, 'Echo'), (MOTOR, 'Motor'),
                                (BUZZ, 'Buzzer'), (BTN, 'Buttons'))):
        ax.plot([lx - 0.1, lx + 0.5], [ly - i * 0.55, ly - i * 0.55], color=c, lw=3)
        ax.text(lx + 0.65, ly - i * 0.55, t, fontsize=7.2, va='center', color=INK)
    warn = ('BEFORE YOU POWER IT:\n'
            '1. Holder must be PARALLEL:\n   multimeter reads 3.0–4.2 V\n   (7–8 V = series: STOP)\n'
            '2. Charge both cells to the\n   same level before joining\n'
            '3. Set MT3608 to 5.0 V with a\n   multimeter BEFORE wiring\n   it to the ESP32\n'
            '4. Never feed 5 V into 3V3\n   or any GPIO pin')
    ax.text(30.75, 12.6, warn, fontsize=7, va='top', color=RED,
            bbox=dict(boxstyle='round,pad=0.4', fc='#fff5f5', ec=RED, lw=1.2))

    fig.tight_layout()
    fig.savefig(os.path.join(HERE, 'wiring_diagram.png'), dpi=170)
    plt.close(fig)


# ──────────────────────────── DRIVER CIRCUITS (Fig. 2) ───────────────────────
def resistor(ax, x0, y0, x1, y1, label):
    """Zig-zag resistor between two points (horizontal or vertical)."""
    import numpy as np
    n = 7
    t = np.linspace(0, 1, n * 2 + 1)
    xs = x0 + (x1 - x0) * t
    ys = y0 + (y1 - y0) * t
    amp = 0.18
    if abs(x1 - x0) > abs(y1 - y0):
        ys = ys + np.array([0] + [amp if i % 2 else -amp for i in range(1, len(t) - 1)] + [0])
        ax.text((x0 + x1) / 2, y0 + 0.35, label, ha='center', fontsize=8, color=INK)
    else:
        xs = xs + np.array([0] + [amp if i % 2 else -amp for i in range(1, len(t) - 1)] + [0])
        ax.text(x0 + 0.35, (y0 + y1) / 2, label, ha='left', va='center', fontsize=8, color=INK)
    ax.plot(xs, ys, color=INK, lw=1.6, zorder=4)


def transistor(ax, x, y, name='S8050'):
    ax.add_patch(Circle((x, y), 0.6, fc='white', ec=INK, lw=1.6, zorder=4))
    ax.plot([x - 0.25, x - 0.25], [y - 0.35, y + 0.35], color=INK, lw=2.2, zorder=5)  # base bar
    ax.plot([x - 0.25, x + 0.25], [y + 0.12, y + 0.5], color=INK, lw=1.6, zorder=5)   # collector
    ax.plot([x - 0.25, x + 0.25], [y - 0.12, y - 0.5], color=INK, lw=1.6, zorder=5)   # emitter
    ax.annotate('', xy=(x + 0.25, y - 0.5), xytext=(x, y - 0.32),
                arrowprops=dict(arrowstyle='-|>', color=INK, lw=1.2), zorder=6)
    ax.text(x + 0.75, y + 0.45, 'C', fontsize=8, fontweight='bold')
    ax.text(x - 1.0, y + 0.08, 'B', fontsize=8, fontweight='bold')
    ax.text(x + 0.75, y - 0.65, 'E', fontsize=8, fontweight='bold')
    ax.text(x + 0.75, y - 0.05, name, fontsize=7.5, color=INK2)


def diode_vertical(ax, x, y_low, y_high):
    """Diode with the stripe (cathode) at the TOP, i.e. toward 3.3 V."""
    mid = (y_low + y_high) / 2
    ax.plot([x, x], [y_low, mid - 0.25], color=INK, lw=1.6)
    ax.plot([x, x], [mid + 0.25, y_high], color=INK, lw=1.6)
    ax.add_patch(Polygon([[x - 0.25, mid - 0.25], [x + 0.25, mid - 0.25], [x, mid + 0.22]], closed=True,
                         fc=INK, ec=INK, zorder=5))
    ax.plot([x - 0.27, x + 0.27], [mid + 0.25, mid + 0.25], color=INK, lw=2.4, zorder=5)
    ax.text(x + 0.35, mid + 0.25, 'stripe', fontsize=7, color=INK2, va='center')


def driver_panel(ax, ox, oy, title, load_label, load_symbol, gpio, color, with_diode):
    ax.text(ox, oy + 6.4, title, fontsize=11, fontweight='bold', color=INK)
    rail_x0, rail_x1 = ox + 2.6, ox + 6.4
    ax.plot([rail_x0, rail_x1], [oy + 5.6, oy + 5.6], color=ORANGE, lw=3)
    ax.text(rail_x1 + 0.1, oy + 5.6, '3.3 V', color=ORANGE, fontsize=9, fontweight='bold', va='center')
    ax.plot([rail_x0, rail_x1], [oy + 0.2, oy + 0.2], color=BLACK, lw=3)
    ax.text(rail_x1 + 0.1, oy + 0.2, 'GND', color=BLACK, fontsize=9, fontweight='bold', va='center')
    lx = ox + 4.6
    # load between 3.3 V and collector
    ax.plot([lx, lx], [oy + 5.6, oy + 4.6], color=INK, lw=1.6)
    ax.add_patch(Circle((lx, oy + 4.15), 0.45, fc='white', ec=color, lw=2, zorder=4))
    ax.text(lx, oy + 4.15, load_symbol, ha='center', va='center', fontsize=9, fontweight='bold', color=color,
            zorder=7)
    ax.text(lx - 0.6, oy + 4.15, load_label, ha='right', va='center', fontsize=8, color=INK)
    ax.text(lx + 0.12, oy + 4.75, '+', fontsize=8, fontweight='bold')
    ax.text(lx + 0.12, oy + 3.45, '−', fontsize=9, fontweight='bold')
    ax.plot([lx, lx], [oy + 3.7, oy + 2.75], color=INK, lw=1.6)
    if with_diode:
        dx = lx + 1.3
        ax.plot([lx, dx], [oy + 5.1, oy + 5.1], color=INK, lw=1.6)
        ax.plot([lx, dx], [oy + 3.2, oy + 3.2], color=INK, lw=1.6)
        diode_vertical(ax, dx, oy + 3.2, oy + 5.1)
        ax.plot(lx, oy + 5.1, 'o', ms=4, color=INK); ax.plot(lx, oy + 3.2, 'o', ms=4, color=INK)
        ax.text(dx + 0.3, oy + 4.6, '1N4148 / 1N4007', fontsize=7, color=INK2)
    transistor(ax, lx - 0.25, oy + 2.2)
    ax.plot([lx, lx], [oy + 1.7, oy + 0.2], color=INK, lw=1.6)
    # base resistor from GPIO
    ax.plot([ox + 0.4, ox + 1.0], [oy + 2.2, oy + 2.2], color=color, lw=2.4)
    ax.text(ox + 0.3, oy + 2.2, gpio, ha='right', va='center', fontsize=9, fontweight='bold', color=color)
    resistor(ax, ox + 1.0, oy + 2.2, ox + 2.9, oy + 2.2, '1 kΩ')
    ax.plot([ox + 2.9, lx - 0.5], [oy + 2.2, oy + 2.2], color=INK, lw=1.6)


def drivers():
    fig, ax = plt.subplots(figsize=(16, 10))
    ax.set_xlim(-1.5, 30); ax.set_ylim(-1.0, 19.5); ax.axis('off')
    ax.text(-1.4, 19.2, 'GuideAI cane — small circuits close-up (Figure 2)', fontsize=15, fontweight='bold',
            color=INK, va='top')

    driver_panel(ax, 0.5, 10.5, 'A. Vibration motor', 'coin motor\n3 V', 'M', 'GPIO25', MOTOR, True)
    driver_panel(ax, 10.5, 10.5, 'B. Active buzzer (3.3 V)', 'buzzer', 'BZ', 'GPIO26', BUZZ, True)

    # C. Button with pull-down (draw two: SOS on GPIO32, MODE on GPIO33)
    ox, oy = 21.0, 10.5
    ax.text(ox, oy + 6.4, 'C. Buttons (SOS and MODE)', fontsize=11, fontweight='bold', color=INK)
    for i, (gpio, name) in enumerate((('GPIO32', 'SOS'), ('GPIO33', 'MODE'))):
        bx = ox + 1.2 + i * 3.6
        ax.plot([bx - 0.8, bx + 0.8], [oy + 5.6, oy + 5.6], color=ORANGE, lw=3)
        ax.plot([bx, bx], [oy + 5.6, oy + 4.6], color=INK, lw=1.6)
        # push button symbol
        ax.plot([bx, bx], [oy + 4.6, oy + 4.35], color=INK, lw=1.6)
        ax.plot([bx - 0.35, bx + 0.35], [oy + 4.1, oy + 4.1], color=INK, lw=2)
        ax.plot([bx, bx], [oy + 4.1, oy + 4.45], color=INK, lw=1.2)
        ax.plot(bx, oy + 3.85, 'o', ms=4, color=INK); ax.plot(bx, oy + 4.35, 'o', ms=4, color=INK)
        ax.text(bx + 0.45, oy + 4.15, f'{name}\nbutton', fontsize=7.5, va='center')
        ax.plot([bx, bx], [oy + 3.85, oy + 3.0], color=INK, lw=1.6)
        ax.plot(bx, oy + 3.0, 'o', ms=5, color=BTN)
        ax.plot([bx, bx + 1.2], [oy + 3.0, oy + 3.0], color=BTN, lw=2.4)
        ax.text(bx + 1.25, oy + 3.0, gpio, fontsize=8.5, fontweight='bold', color=BTN, va='center')
        resistor(ax, bx, oy + 3.0, bx, oy + 1.1, '10 kΩ')
        ax.plot([bx, bx], [oy + 1.1, oy + 0.2], color=INK, lw=1.6)
        ax.plot([bx - 0.8, bx + 0.8], [oy + 0.2, oy + 0.2], color=BLACK, lw=3)
    ax.text(ox + 3.0, oy + 5.85, '3.3 V', color=ORANGE, fontsize=9, fontweight='bold', ha='center')
    ax.text(ox + 3.0, oy - 0.35, 'GND', color=BLACK, fontsize=9, fontweight='bold', ha='center')
    ax.text(ox, oy - 0.9, 'Not pressed: pin reads LOW (0). Pressed: HIGH (1).\n'
            'Metal buttons with a light ring: use the two switch\nlegs (C and NO); ignore the LED legs.',
            fontsize=7.5, color=INK2, va='top')

    # D. Battery level divider (optional)
    ox, oy = 0.5, 0.8
    ax.text(ox, oy + 7.2, 'D. Battery level (optional)', fontsize=11, fontweight='bold', color=INK)
    ax.text(ox + 0.2, oy + 6.4, 'Battery + after the ON/OFF switch\n(= MT3608 VIN+)', fontsize=8, color=RED)
    ax.plot([ox + 2.0, ox + 2.0], [oy + 5.9, oy + 5.2], color=RED, lw=2.4)
    resistor(ax, ox + 2.0, oy + 5.2, ox + 2.0, oy + 3.6, '100 kΩ')
    ax.plot(ox + 2.0, oy + 3.3, 'o', ms=5, color=INK2)
    ax.plot([ox + 2.0, ox + 2.0], [oy + 3.6, oy + 3.0], color=INK, lw=1.6)
    ax.plot([ox + 2.0, ox + 3.6], [oy + 3.3, oy + 3.3], color=INK2, lw=2.4)
    ax.text(ox + 3.7, oy + 3.3, 'GPIO34 (max 2.1 V here)', fontsize=8.5, fontweight='bold', color=INK2, va='center')
    resistor(ax, ox + 2.0, oy + 3.0, ox + 2.0, oy + 1.4, '100 kΩ')
    ax.plot([ox + 2.0, ox + 2.0], [oy + 1.4, oy + 0.8], color=INK, lw=1.6)
    ax.plot([ox + 1.2, ox + 2.8], [oy + 0.8, oy + 0.8], color=BLACK, lw=3)
    ax.text(ox + 3.0, oy + 0.8, 'GND', fontsize=9, fontweight='bold', color=BLACK, va='center')

    # E. Transistor pin-out
    ox, oy = 10.5, 0.8
    ax.text(ox, oy + 7.2, 'E. Transistor legs (TO-92)', fontsize=11, fontweight='bold', color=INK)
    from matplotlib.patches import Wedge
    ax.add_patch(Wedge((ox + 2.5, oy + 4.6), 1.2, 0, 180, fc='#2b2b2b', ec=INK))
    ax.add_patch(FancyBboxPatch((ox + 1.3, oy + 3.4), 2.4, 1.2, boxstyle='square,pad=0', fc='#2b2b2b', ec=INK))
    ax.text(ox + 2.5, oy + 4.3, 'S8050', color='white', ha='center', fontsize=9, fontweight='bold')
    for i, leg in enumerate(('E', 'B', 'C')):
        x = ox + 1.75 + i * 0.75
        ax.plot([x, x], [oy + 3.4, oy + 1.8], color='#9aa0a6', lw=3)
        ax.text(x, oy + 1.4, leg, ha='center', fontsize=11, fontweight='bold')
    ax.text(ox, oy + 0.7, 'Flat side facing you, legs down: E – B – C\n'
            '(S8050 and PN2222A). Check the print on yours:\n'
            'P2N2222A is the other way round (C – B – E).', fontsize=8, color=INK2, va='top')

    # F. Notes
    ox, oy = 21.0, 0.8
    ax.text(ox, oy + 7.2, 'F. Good to know', fontsize=11, fontweight='bold', color=INK)
    ax.text(ox, oy + 6.6,
            '• The transistor is a switch: GPIO HIGH = on, LOW = off.\n'
            '  The ESP32 pin gives ~20 mA; the motor needs 60–90 mA.\n'
            '• Diode stripe goes to the 3.3 V side. It soaks up the\n'
            '  voltage kick when the motor or buzzer turns off.\n'
            '• Coin motor: red wire = +, black/blue = −.\n'
            '• Active buzzer: long leg or "+" mark = +.\n'
            '• All GNDs must be joined: battery, charger OUT−,\n'
            '  MT3608, ESP32, sensors, transistors.',
            fontsize=8, color=INK, va='top')

    fig.tight_layout()
    fig.savefig(os.path.join(HERE, 'driver_circuits.png'), dpi=170)
    plt.close(fig)


if __name__ == '__main__':
    main_diagram()
    drivers()
    print('wrote hardware/wiring_diagram.png and hardware/driver_circuits.png')
