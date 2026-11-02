"""
Draws the GuideAI use-case diagram and entity-relationship diagram (ERD) into capstone_paper/figures/.
Run:  model\\train-venv\\Scripts\\python.exe capstone_paper\\make_design_diagrams.py
The entities match the real code: mobile/src/stores/userStore.ts (@guideai_user),
mobile/src/services/emergency/contacts.service.ts (@guideai_emergency_contacts),
mobile/src/services/training/sampleCollector.ts (training-samples folder), and
server/supabase_migration_remove_accounts.sql + server/src (emergency_events).
"""
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, 'figures')
os.makedirs(FIG, exist_ok=True)

BLUE, ORANGE, PURPLE, GREY = '#2a78d6', '#eb6834', '#8250df', '#8c959f'
INK, INK2, PANEL = '#1f2328', '#57606a', '#f6f8fa'
plt.rcParams.update({'font.family': 'DejaVu Sans'})


# ───────────────────────────── USE-CASE DIAGRAM ─────────────────────────────
def actor(ax, x, y, label, color=INK, dashed=False):
    ls = '--' if dashed else '-'
    ax.add_patch(Ellipse((x, y + 0.42), 0.34, 0.34, fc='white', ec=color, lw=1.4, ls=ls))
    ax.plot([x, x], [y + 0.25, y - 0.2], color=color, lw=1.4, ls=ls)
    ax.plot([x - 0.22, x + 0.22], [y + 0.05, y + 0.05], color=color, lw=1.4, ls=ls)
    ax.plot([x, x - 0.18], [y - 0.2, y - 0.5], color=color, lw=1.4, ls=ls)
    ax.plot([x, x + 0.18], [y - 0.2, y - 0.5], color=color, lw=1.4, ls=ls)
    ax.text(x, y - 0.75, label, ha='center', va='top', fontsize=8.5, color=INK, fontweight='bold')


def usecase_diagram():
    fig, ax = plt.subplots(figsize=(11, 9))
    ax.set_xlim(-4.4, 10.8); ax.set_ylim(-2.2, 12.6); ax.axis('off')

    # System boundary and title
    ax.add_patch(FancyBboxPatch((0.0, -0.9), 6.9, 12.6, boxstyle='round,pad=0.02,rounding_size=0.2',
                                fc=PANEL, ec=GREY, lw=1.2))
    ax.text(3.45, 11.2, 'GuideAI (Android app, runs offline)', ha='center', fontsize=10.5,
            fontweight='bold', color=INK)

    # Use cases, one per row, centred inside the boundary
    cx, w, h = 3.45, 4.7, 0.56
    rows = [
        ('detect', 'Detect obstacles and hear warnings (UC1)', BLUE),
        ('describe', "Describe what's ahead (UC2)", BLUE),
        ('read', 'Read printed text (UC3)', BLUE),
        ('navigate', 'Navigate to a place with spoken directions (UC4)', BLUE),
        ('where', 'Where am I? (UC5)', BLUE),
        ('voice', 'Give a voice command (UC6)', BLUE),
        ('sos', 'Send emergency SOS, with 5-second cancel (UC7)', ORANGE),
        ('resolve', 'Mark SOS as resolved (UC8)', ORANGE),
        ('contacts', 'Manage emergency contacts (UC9)', BLUE),
        ('settings', 'Change settings (UC10)', BLUE),
        ('ai', 'Name objects with AI, online (UC11)', PURPLE),
        ('teach', 'Save pictures and names for training (UC12)', PURPLE),
    ]
    uc = {}
    for i, (key, text, color) in enumerate(rows):
        y = 10.6 - i * 0.88
        ax.add_patch(Ellipse((cx, y), w, h, fc='white', ec=color, lw=1.3))
        ax.text(cx, y, text, ha='center', va='center', fontsize=8, color=INK)
        uc[key] = (cx, y)
    left_edge = cx - w / 2
    right_edge = cx + w / 2

    # Primary actor: blind pedestrian (left, middle)
    ax_x = -2.7
    actor(ax, ax_x, 6.2, 'Blind or visually\nimpaired pedestrian')
    for key in ('detect', 'describe', 'read', 'navigate', 'where', 'voice', 'sos', 'contacts', 'settings', 'ai', 'teach'):
        ax.plot([ax_x + 0.24, left_edge], [6.25, uc[key][1]], color=INK2, lw=0.8, zorder=0)

    # Family / helper (left, lower): receives the SMS, marks the SOS resolved
    actor(ax, ax_x, 2.0, 'Family, helper or\nemergency contact')
    ax.plot([ax_x + 0.24, left_edge], [2.05, uc['resolve'][1]], color=INK2, lw=0.8, zorder=0)
    ax.plot([ax_x + 0.24, left_edge], [2.1, uc['sos'][1] - 0.1], color=INK2, lw=0.8, ls='--', zorder=0)
    ax.text(-0.9, 1.0, 'receives the SMS', fontsize=7, color=INK2, ha='center')

    # Developer (left, bottom): outside the app, uses the PC
    actor(ax, ax_x, -1.5, 'Developer / researcher\n(PC, outside the app)', dashed=True)
    ax.plot([ax_x + 0.24, left_edge], [-1.45, uc['teach'][1]], color=INK2, lw=0.8, ls='--', zorder=0)

    # External services (right side)
    ex = 9.1
    actor(ax, ex, 10.0, 'Google Gemini\n(online AI)', color=PURPLE)
    actor(ax, ex, 6.6, 'OpenStreetMap\nservices (online)')
    actor(ax, ex, 3.2, 'Mobile network\n(SIM SMS)', color=ORANGE)
    actor(ax, ex, 0.0, 'Smart cane (ESP32)\n(planned)', color=GREY, dashed=True)
    ax.plot([right_edge, ex - 0.24], [uc['voice'][1], 9.9], color=PURPLE, lw=0.9, ls='--', zorder=0)
    ax.plot([right_edge, ex - 0.24], [uc['ai'][1], 9.8], color=PURPLE, lw=0.9, ls='--', zorder=0)
    ax.plot([right_edge, ex - 0.24], [uc['navigate'][1], 6.6], color=INK2, lw=0.9, ls='--', zorder=0)
    ax.plot([right_edge, ex - 0.24], [uc['sos'][1], 3.3], color=ORANGE, lw=0.9, zorder=0)
    ax.plot([right_edge, ex - 0.24], [uc['resolve'][1], 3.2], color=ORANGE, lw=0.9, zorder=0)
    ax.plot([right_edge, ex - 0.24], [uc['detect'][1], 0.9], color=GREY, lw=0.8, ls='--', zorder=0)

    # Include note, below the boundary and clear of every use case
    ax.text(3.45, -1.45, '<<include>> Describe, Read and Navigate keep the SOS button reachable at all times',
            ha='center', fontsize=7.4, color=INK2, style='italic')
    ax.text(-4.3, 12.4, 'Use-case diagram. Solid lines: a user performs the use case.  '
            'Dashed: optional or external services.', fontsize=8, color=INK2)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_usecase.png'), dpi=200)
    plt.close(fig)


# ───────────────────────────────── ERD ──────────────────────────────────────
def entity(ax, x, y, title, fields, color=BLUE, w=3.6, note=None):
    line_h = 0.36
    h = 0.5 + line_h * len(fields) + 0.12
    ax.add_patch(FancyBboxPatch((x, y - h), w, h, boxstyle='round,pad=0.0,rounding_size=0.08',
                                fc='white', ec=color, lw=1.4))
    ax.add_patch(Rectangle((x, y - 0.46), w, 0.46, fc=color, ec=color, lw=1.4))
    ax.text(x + w / 2, y - 0.23, title, ha='center', va='center', fontsize=9, color='white', fontweight='bold')
    for i, f in enumerate(fields):
        yy = y - 0.46 - 0.26 - i * line_h
        ax.text(x + 0.12, yy, f, ha='left', va='center', fontsize=7.4, color=INK,
                fontweight='bold' if f.startswith(('PK', 'FK')) else 'normal')
    if note:
        ax.text(x + w / 2, y - h - 0.2, note, ha='center', va='top', fontsize=6.8, color=INK2, style='italic')
    return {'x': x, 'y': y, 'w': w, 'h': h}


def rel(ax, a, b, a_side, b_side, label_a, label_b, dashed=False, color=INK2):
    def pt(box, side):
        if side == 'r':
            return box['x'] + box['w'], box['y'] - box['h'] / 2
        if side == 'l':
            return box['x'], box['y'] - box['h'] / 2
        if side == 'b':
            return box['x'] + box['w'] / 2, box['y'] - box['h']
        return box['x'] + box['w'] / 2, box['y']
    (x1, y1), (x2, y2) = pt(a, a_side), pt(b, b_side)
    ax.plot([x1, x2], [y1, y2], color=color, lw=1.1, ls='--' if dashed else '-', zorder=0)
    ax.text(x1 + (0.12 if a_side == 'r' else -0.12 if a_side == 'l' else 0),
            y1 + (0.12 if a_side in ('t', 'b') else 0.0), label_a, fontsize=7.4, color=INK,
            ha='left' if a_side == 'r' else 'right' if a_side == 'l' else 'center', va='bottom')
    ax.text(x2 + (0.12 if b_side == 'r' else -0.12 if b_side == 'l' else 0),
            y2 + (0.12 if b_side in ('t', 'b') else 0.0), label_b, fontsize=7.4, color=INK,
            ha='left' if b_side == 'r' else 'right' if b_side == 'l' else 'center', va='bottom')


def erd():
    fig, ax = plt.subplots(figsize=(12, 8.6))
    ax.set_xlim(-0.4, 12.6); ax.set_ylim(-1.0, 9.2); ax.axis('off')

    device = entity(ax, 0.2, 8.6, 'DEVICE_USER  (phone)', [
        'PK  device_id        text (random, no login)',
        '    name             text (typed by the user)',
        '    has_onboarded    boolean',
        '    settings_version integer',
    ], color=BLUE, note='key @guideai_user in phone storage')

    settings = entity(ax, 0.2, 4.1, 'SETTINGS  (one per phone)', [
        'PK  (belongs to DEVICE_USER)',
        '    tts_speed / tts_pitch / tts_language',
        '    haptic_intensity   low | medium | high',
        '    detection_source   camera | cane | both',
        '    collect_training_photos   boolean',
        '    smart_identify     boolean',
        '    custom_object_names   list of text',
    ], color=BLUE, note='stored inside @guideai_user')

    contact = entity(ax, 4.9, 8.6, 'EMERGENCY_CONTACT', [
        'PK  id              text',
        'FK  owner_device_id text (the phone)',
        '    name            text',
        '    phone_number    text (PH format checked)',
        '    relationship    text',
        '    notify_by_sms   boolean',
        '    created_at      timestamp',
    ], color=ORANGE, note='key @guideai_emergency_contacts')

    sos = entity(ax, 9.0, 8.6, 'SOS_EVENT  (server table)', [
        'PK  id                text',
        'FK  device_id         text (no user account)',
        '    latitude, longitude   numeric',
        '    address           text (optional)',
        '    contacts_notified integer',
        '    status            active | resolved | cancelled',
        '    triggered_at / resolved_at  timestamp',
    ], color=ORANGE, note='server table: emergency_events')

    sample = entity(ax, 4.9, 2.2, 'TRAINING_SAMPLE  (files)', [
        'PK  name            text (gai_YYYYMMDD_HHMMSS_reason)',
        'FK  device_id       (the phone it was saved on)',
        '    picture         BMP file (letterboxed camera frame)',
        '    suggestions     JSON: model guesses, reported flag',
        '    reason          unsure | periodic | manual',
        '    user_label      text (typed with Teach My AI)',
    ], color=PURPLE, note='folder training-samples on the phone')

    entity(ax, 9.0, 2.2, 'PLACE  (built in)', [
        'PK  name            text',
        '    latitude, longitude  numeric',
        '    (Public Market, Silliman Medical,',
        '     Rizal Boulevard, CityMall,',
        '     Port Terminal, ...)',
    ], color=GREY, note='constants in the app, not user data')

    ax.text(0.2, -0.85, 'Not stored: navigation routes (computed each time), text-reader history '
            '(kept only while the screen is open),\ncamera frames and detections (live only).',
            fontsize=7.2, color=INK2, style='italic', va='top')

    # Relationships (cardinalities written at each end)
    rel(ax, device, contact, 'r', 'l', '1', '0..*')
    rel(ax, device, sos, 'r', 'l', '1', '0..*', dashed=True)
    rel(ax, device, sample, 'r', 'l', '1', '0..*', dashed=True, color=PURPLE)
    rel(ax, device, settings, 'b', 't', '1', '1')

    ax.text(12.5, -0.9, 'Solid: stored on the phone.  Dashed: server or optional.\n'
            'SMS goes to the contacts listed above; no database link is needed.', ha='right',
            fontsize=7.6, color=INK2)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, 'fig_erd.png'), dpi=200)
    plt.close(fig)


if __name__ == '__main__':
    usecase_diagram()
    erd()
    print('wrote fig_usecase.png and fig_erd.png to', FIG)
