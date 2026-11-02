"""
Builds hardware/wokwi/diagram.json: the GuideAI cane circuit for the Wokwi simulator, laid out top to
bottom like the cane's front view (grip -> box -> sensors at the bottom of the box), with every wire
drawn as straight horizontal/vertical runs.

Run:  model\\train-venv\\Scripts\\python.exe hardware\\wokwi\\make_diagram.py [--preview out.png]
Pin positions come from @wokwi/elements 1.9.2 (pinInfo of each part).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# ── part sizes and pin offsets (px, unrotated) ──
PINS = {
    'wokwi-esp32-devkit-v1': {
        'VIN': (5, 158.5), 'GND.2': (5, 149), 'D27': (5, 110.8), 'D26': (5, 101), 'D25': (5, 91.3), 'D33': (5, 81.7),
        'D32': (5, 72.2), 'D35': (5, 62.9), 'D34': (5, 53.1),
        '3V3': (101.3, 158.5), 'GND.1': (101.3, 149), 'RX2': (101.3, 110.8), 'TX2': (101.3, 101),
        'D21': (101.3, 62.9), 'D22': (101.3, 34)},
    'wokwi-hc-sr04': {'VCC': (71.3, 94.5), 'TRIG': (81.3, 94.5), 'ECHO': (91.3, 94.5), 'GND': (101.3, 94.5)},
    'wokwi-mpu6050': {'SDA': (45.6, 5.78), 'SCL': (55.2, 5.78), 'GND': (64.8, 5.78), 'VCC': (74.4, 5.78)},
    'wokwi-buzzer': {'1': (27, 84), '2': (37, 84)},
    'wokwi-pushbutton': {'1.l': (0, 13), '2.l': (0, 32), '1.r': (67, 13), '2.r': (67, 32)},
    'wokwi-led': {'A': (25, 42), 'C': (15, 42)},
    'wokwi-resistor': {'1': (0, 5.65), '2': (58.8, 5.65)},
    'wokwi-slide-potentiometer': {'VCC': (1, 43), 'SIG': (1, 63), 'GND': (207, 43)},
}
SIZE = {'wokwi-esp32-devkit-v1': (107, 201), 'wokwi-hc-sr04': (170.1, 94.5), 'wokwi-mpu6050': (81.6, 61.2),
        'wokwi-buzzer': (64, 75), 'wokwi-pushbutton': (67, 45), 'wokwi-led': (40, 50),
        'wokwi-resistor': (59, 11.3), 'wokwi-slide-potentiometer': (208, 109.6)}

# ── parts: id -> (type, left, top, rotate, attrs) ──
PARTS = {
    # grip (top)
    'btn_sos':  ('wokwi-pushbutton', 150, 40, 0, {'color': 'red', 'label': 'SOS'}),
    'r_sos':    ('wokwi-resistor', 70, 66.35, 0, {'value': '10000'}),
    'btn_mode': ('wokwi-pushbutton', 150, 130, 0, {'color': 'white', 'label': 'MODE'}),
    'r_mode':   ('wokwi-resistor', 70, 156.35, 0, {'value': '10000'}),
    'motor':    ('wokwi-led', 160, 215, 0, {'color': 'purple', 'label': 'motor'}),
    'r_motor':  ('wokwi-resistor', 195, 251.35, 0, {'value': '220'}),
    # box (middle)
    'esp':      ('wokwi-esp32-devkit-v1', 300, 330, 0, {}),
    'buzzer':   ('wokwi-buzzer', 150, 312, 0, {'volume': '0.1'}),
    'mpu':      ('wokwi-mpu6050', 570, 470, 0, {}),
    # sensors at the bottom of the box
    'laser':    ('wokwi-slide-potentiometer', 45, 485, 180, {'travelLength': '30', 'value': '40'}),
    'ultra':    ('wokwi-hc-sr04', 441.2, 640, 180, {'distance': '300'}),
}


def pin_xy(part_id, pin):
    typ, left, top, rot, _ = PARTS[part_id]
    x, y = PINS[typ][pin]
    if rot == 180:
        w, h = SIZE[typ]
        x, y = w - x, h - y
    return round(left + x, 2), round(top + y, 2)


# ── wires: (from, to, color, waypoints). A waypoint is ('h', x) or ('v', y): move horizontally to x or
# vertically to y. The last run to the target pin is added automatically and must be straight. ──
GND_RAIL, V33_RAIL = 40, 20       # left-side power rails
V33_DOWN, GND_DOWN = 410, 420     # power lanes leaving the bottom-right of the ESP32
V33_RIGHT, GND_RIGHT = 720, 740   # power lanes up the right side
WIRES = [
    # grip: buttons (3V3 -> button -> GPIO, 10k pull-down to GND)
    ('esp:3V3', 'btn_sos:1.l', 'red', [('h', V33_DOWN), ('v', 610), ('h', V33_RAIL), ('v', 53)]),
    ('esp:3V3', 'btn_mode:1.l', 'red', [('h', V33_DOWN), ('v', 610), ('h', V33_RAIL), ('v', 143)]),
    ('btn_sos:2.l', 'r_sos:2', 'green', []),
    ('btn_mode:2.l', 'r_mode:2', 'green', []),
    ('esp:GND.2', 'r_sos:1', 'black', [('h', GND_RAIL), ('v', 72)]),
    ('esp:GND.2', 'r_mode:1', 'black', [('h', GND_RAIL), ('v', 162)]),
    ('btn_sos:2.r', 'esp:D32', 'green', [('h', 285), ('v', 402.2)]),
    ('btn_mode:2.r', 'esp:D33', 'green', [('h', 275), ('v', 411.7)]),
    # grip: vibration motor (an LED stands in for the motor + transistor)
    ('esp:D25', 'r_motor:2', 'violet', [('h', 265), ('v', 257)]),
    ('r_motor:1', 'motor:A', 'violet', []),
    ('esp:GND.2', 'motor:C', 'black', [('h', GND_RAIL), ('v', 290), ('h', 175)]),
    # box: buzzer
    ('esp:D26', 'buzzer:2', 'orange', [('h', 187)]),
    ('esp:GND.2', 'buzzer:1', 'black', [('h', GND_RAIL), ('v', 455), ('h', 177)]),
    # box: MPU6050 on I2C, powered from the right side
    ('esp:D21', 'mpu:SDA', 'yellow', [('h', 615.6)]),
    ('esp:D22', 'mpu:SCL', 'cyan', [('h', 625.2)]),
    ('esp:3V3', 'mpu:VCC', 'red', [('h', V33_DOWN), ('v', 760), ('h', V33_RIGHT), ('v', 455), ('h', 644.4)]),
    ('esp:GND.1', 'mpu:GND', 'black', [('h', GND_DOWN), ('v', 770), ('h', GND_RIGHT), ('v', 445), ('h', 634.8)]),
    # bottom: ultrasonic (HC-SR04 stands in for the RCWL-1601: same Trig/Echo signals)
    ('esp:TX2', 'ultra:TRIG', 'blue', [('h', 530)]),
    ('esp:RX2', 'ultra:ECHO', 'purple', [('h', 520)]),
    ('esp:GND.1', 'ultra:GND', 'black', [('h', GND_DOWN), ('v', 620), ('h', 510)]),
    ('esp:3V3', 'ultra:VCC', 'red', [('h', V33_DOWN), ('v', 760), ('h', V33_RIGHT), ('v', 630), ('h', 540)]),
    # bottom: laser (a slider on GPIO27 stands in for the VL53L0X ground distance, simulation only)
    ('esp:D27', 'laser:SIG', 'gold', [('h', 265), ('v', 531.6)]),
    ('esp:3V3', 'laser:VCC', 'red', [('h', V33_DOWN), ('v', 610), ('h', 258), ('v', 551.6)]),
    ('esp:GND.2', 'laser:GND', 'black', [('h', GND_RAIL), ('v', 551.6)]),
]


def route(src, dst, waypoints):
    """Absolute polyline and Wokwi path instructions for one wire."""
    x, y = pin_xy(*src.split(':'))
    tx, ty = pin_xy(*dst.split(':'))
    pts, instr = [(x, y)], []
    for axis, v in waypoints:
        if axis == 'h':
            instr.append(f'h{round(v - x, 2):g}'); x = v
        else:
            instr.append(f'v{round(v - y, 2):g}'); y = v
        pts.append((x, y))
    if abs(tx - x) > 0.05 and abs(ty - y) > 0.05:
        raise ValueError(f'{src} -> {dst}: last run ({x},{y}) -> ({tx},{ty}) is diagonal')
    pts.append((tx, ty))
    return pts, instr


def build():
    parts = []
    for pid, (typ, left, top, rot, attrs) in PARTS.items():
        p = {'type': typ, 'id': pid, 'top': top, 'left': left, 'attrs': attrs}
        if rot:
            p['rotate'] = rot
        parts.append(p)
    connections, polylines = [], []
    for src, dst, color, wp in WIRES:
        pts, instr = route(src, dst, wp)
        connections.append([src, dst, color, instr])
        polylines.append((pts, color, src, dst))
    # the Serial Monitor needs these two
    connections = [['esp:TX0', '$serialMonitor:RX', '', []], ['esp:RX0', '$serialMonitor:TX', '', []]] + connections
    diagram = {'version': 1, 'author': 'GuideAI', 'editor': 'wokwi', 'parts': parts, 'connections': connections,
               'dependencies': {}}
    with open(os.path.join(HERE, 'diagram.json'), 'w', encoding='utf-8') as f:
        json.dump(diagram, f, indent=2)
    return polylines


def crossings(polylines):
    """Pairs of wires on different nets whose segments cross (for checking the layout)."""
    net = {}

    def find(a):
        while net.get(a, a) != a:
            a = net[a]
        return a
    for _, _, s, d in polylines:
        net[find(s)] = find(d)
    segs = []
    for pts, _, s, d in polylines:
        for a, b in zip(pts, pts[1:]):
            segs.append((a, b, find(s), f'{s}->{d}'))
    out = set()
    for i, (a1, b1, n1, w1) in enumerate(segs):
        for a2, b2, n2, w2 in segs[i + 1:]:
            if n1 == n2:
                continue
            h1, h2 = a1[1] == b1[1], a2[1] == b2[1]
            if h1 == h2:
                continue
            (ha, hb), (va, vb) = ((a1, b1), (a2, b2)) if h1 else ((a2, b2), (a1, b1))
            x0, x1 = sorted((ha[0], hb[0])); y0, y1 = sorted((va[1], vb[1]))
            if x0 < va[0] < x1 and y0 < ha[1] < y1:
                out.add(tuple(sorted((w1, w2))))
    return sorted(out)


def preview(polylines, path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    fig, ax = plt.subplots(figsize=(9, 11))
    for pid, (typ, left, top, rot, _) in PARTS.items():
        w, h = SIZE[typ]
        ax.add_patch(Rectangle((left, top), w, h, fc='#eeeeee', ec='#888'))
        ax.text(left + w / 2, top + h / 2, pid, ha='center', va='center', fontsize=7)
    cmap = {'gold': '#c9a227', 'violet': '#8a2be2', 'cyan': '#00a3a3', 'yellow': '#d4c200'}
    for pts, color, _, _ in polylines:
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=cmap.get(color, color), lw=1.4)
    ax.set_aspect('equal'); ax.invert_yaxis()
    fig.savefig(path, dpi=110, bbox_inches='tight')


if __name__ == '__main__':
    lines = build()
    bad = crossings(lines)
    print(f'wrote diagram.json: {len(PARTS)} parts, {len(WIRES)} wires, {len(bad)} crossings')
    for pair in bad:
        print('  cross:', *pair)
    if '--preview' in sys.argv:
        preview(lines, sys.argv[sys.argv.index('--preview') + 1])
