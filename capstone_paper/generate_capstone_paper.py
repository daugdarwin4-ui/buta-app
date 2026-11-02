"""
Generates the GuideAI capstone paper (Word .docx) from the real system and its measured results.

Run from the BUTA APP folder:
    model\\train-venv\\Scripts\\python.exe capstone_paper\\make_figures.py      (figures)
    model\\train-venv\\Scripts\\python.exe capstone_paper\\generate_capstone_paper.py
Then open the .docx in Word and press F9 (or right-click the tables of contents > Update Field)
if the page numbers in the contents are not filled in yet.

Text in [square brackets] is for the proponents to fill in (names, school, dates, survey results).
"""
import json
import os
from typing import cast

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from docx.styles.style import ParagraphStyle

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, 'figures')
OUT = os.path.join(os.path.dirname(HERE), 'GuideAI_Capstone_Paper.docx')
EVAL = json.load(open(os.path.join(HERE, 'eval_results.json')))
V1, V2 = list(EVAL)

FONT = 'Times New Roman'
doc = Document()


def pstyle(name: str) -> ParagraphStyle:
    return cast(ParagraphStyle, doc.styles[name])


# ── Page setup and styles ───────────────────────────────────────────────────
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = Inches(1.5)
sec.right_margin = sec.top_margin = sec.bottom_margin = Inches(1)

normal = pstyle('Normal')
normal.font.name = FONT
normal.font.size = Pt(12)
normal.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
normal.paragraph_format.line_spacing = 1.5
normal.paragraph_format.space_after = Pt(6)

for name, size, center in (('Heading 1', 14, True), ('Heading 2', 12, False), ('Heading 3', 12, False)):
    st = pstyle(name)
    st.font.name = FONT
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.italic = name == 'Heading 3'
    st.font.color.rgb = RGBColor(0, 0, 0)
    rpr = st.element.get_or_add_rPr()
    rfonts = rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.append(rfonts)
    for attr in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        rfonts.set(qn(attr), FONT)
    for attr in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme'):
        if rfonts.get(qn(attr)) is not None:
            del rfonts.attrib[qn(attr)]
    pf = st.paragraph_format
    pf.space_before = Pt(18 if name == 'Heading 1' else 12)
    pf.space_after = Pt(12 if name == 'Heading 1' else 6)
    pf.line_spacing = 1.15
    pf.keep_with_next = True
    if center:
        pf.alignment = WD_ALIGN_PARAGRAPH.CENTER

cap_style = pstyle('Caption')
cap_style.font.name = FONT
cap_style.font.size = Pt(11)
cap_style.font.bold = False
cap_style.font.italic = True
cap_style.font.color.rgb = RGBColor(0, 0, 0)


# ── Helpers ──────────────────────────────────────────────────────────────────
def field(paragraph, instr, placeholder=''):
    """Insert a Word field (TOC, SEQ, PAGE…); Word fills it when fields are updated."""
    r = paragraph.add_run()
    b = OxmlElement('w:fldChar'); b.set(qn('w:fldCharType'), 'begin'); r._r.append(b)
    r2 = paragraph.add_run()
    t = OxmlElement('w:instrText'); t.set(qn('xml:space'), 'preserve'); t.text = f' {instr} '; r2._r.append(t)
    r3 = paragraph.add_run()
    s = OxmlElement('w:fldChar'); s.set(qn('w:fldCharType'), 'separate'); r3._r.append(s)
    paragraph.add_run(placeholder)
    r4 = paragraph.add_run()
    e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), 'end'); r4._r.append(e)


def p(text='', bold_lead=None, align='justify', indent=True, italic=False, size=None, space_after=6, bold=False):
    para = doc.add_paragraph()
    para.alignment = {'justify': WD_ALIGN_PARAGRAPH.JUSTIFY, 'center': WD_ALIGN_PARAGRAPH.CENTER,
                      'left': WD_ALIGN_PARAGRAPH.LEFT, 'right': WD_ALIGN_PARAGRAPH.RIGHT}[align]
    para.paragraph_format.space_after = Pt(space_after)
    if indent and align == 'justify':
        para.paragraph_format.first_line_indent = Inches(0.5)
    if bold_lead:
        r = para.add_run(bold_lead)
        r.bold = True
        if size:
            r.font.size = Pt(size)
    if text:
        r = para.add_run(text)
        r.italic = italic
        r.bold = bold
        if size:
            r.font.size = Pt(size)
    return para


def bullets(items, style='List Bullet'):
    for it in items:
        para = doc.add_paragraph(style=style)
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        para.paragraph_format.space_after = Pt(3)
        if isinstance(it, tuple):
            r = para.add_run(it[0]); r.bold = True
            para.add_run(it[1])
        else:
            para.add_run(it)


def numbered(items):
    """Numbered list that starts again at 1 (a new numbering instance per list)."""
    numbering = doc.part.numbering_part.element
    style_num = doc.styles['List Number'].element.pPr.numPr.numId.val
    abstract = next(n for n in numbering.findall(qn('w:num')) if n.numId == style_num).abstractNumId.val
    num = numbering.add_num(abstract)
    override = num.add_lvlOverride(ilvl=0)
    override.add_startOverride(1)
    start = len(doc.paragraphs)
    bullets(items, 'List Number')
    for para in doc.paragraphs[start:]:
        para._p.get_or_add_pPr().get_or_add_numPr().get_or_add_numId().val = num.numId
        para._p.get_or_add_pPr().get_or_add_numPr().get_or_add_ilvl().val = 0


def h1(chapter, title):
    para = doc.add_paragraph(style='Heading 1')
    para.add_run(chapter)
    para.add_run().add_break(WD_BREAK.LINE)
    para.add_run(title)


def h2(text):
    doc.add_paragraph(text, style='Heading 2')


def h3(text):
    doc.add_paragraph(text, style='Heading 3')


def front_heading(text):
    """Centered bold heading for preliminary pages (listed in the contents)."""
    para = doc.add_paragraph(text, style='Heading 1')
    return para


def caption(kind, text):
    para = doc.add_paragraph(style='Caption')
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER if kind == 'Figure' else WD_ALIGN_PARAGRAPH.LEFT
    para.paragraph_format.keep_with_next = kind == 'Table'
    para.add_run(f'{kind} ')
    field(para, f'SEQ {kind} \\* ARABIC', '1')
    para.add_run(f'. {text}')


def figure(name, text, width=5.5):
    path = os.path.join(FIG, name)
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.keep_with_next = True
    para.add_run().add_picture(path, width=Inches(width))
    caption('Figure', text)


def figures_row(items, width=1.85):
    """Several phone screenshots side by side, with one caption each (as a borderless table)."""
    t = doc.add_table(rows=2, cols=len(items))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (name, label) in enumerate(items):
        c = t.cell(0, i)
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        c.paragraphs[0].add_run().add_picture(os.path.join(FIG, name), width=Inches(width))
        lc = t.cell(1, i).paragraphs[0]
        lc.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = lc.add_run(label); r.font.size = Pt(10); r.italic = True


def shade(cell, hex_fill):
    tcPr = cell._element.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_fill)
    tcPr.append(shd)


def table(headers, rows, widths, title=None, size=10):
    if title:
        caption('Table', title)
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, h in enumerate(headers):
        c = t.cell(0, j)
        c.width = Inches(widths[j])
        shade(c, 'D9E2F3')
        para = c.paragraphs[0]
        para.paragraph_format.line_spacing = 1.0
        para.paragraph_format.space_after = Pt(0)
        r = para.add_run(h); r.bold = True; r.font.size = Pt(size)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.cell(i + 1, j)
            c.width = Inches(widths[j])
            para = c.paragraphs[0]
            para.paragraph_format.line_spacing = 1.0
            para.paragraph_format.space_after = Pt(0)
            r = para.add_run(str(val)); r.font.size = Pt(size)
    # Repeat the header row on every page
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def page_break():
    """Start a new page. The break goes at the end of the last paragraph, so a page that is exactly
    full does not leave an empty page behind (a separate break paragraph would spill over)."""
    body = doc.element.body
    last = body[-2] if body[-1].tag == qn('w:sectPr') else body[-1]
    if last.tag == qn('w:p'):
        doc.paragraphs[-1].add_run().add_break(WD_BREAK.PAGE)
    else:
        doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def page_numbers(section, fmt, start=None):
    sectPr = section._sectPr
    pg = sectPr.find(qn('w:pgNumType'))
    if pg is None:
        pg = OxmlElement('w:pgNumType'); sectPr.append(pg)
    pg.set(qn('w:fmt'), fmt)
    if start is not None:
        pg.set(qn('w:start'), str(start))
    section.footer.is_linked_to_previous = False
    fp = section.footer.paragraphs[0]
    for r in list(fp.runs):
        r._r.getparent().remove(r._r)
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    field(fp, 'PAGE', '1')


def pct(x):
    return f'{x:.3f}'


# ═══════════════════════════════════════════════════════════════════════════
# TITLE PAGE
# ═══════════════════════════════════════════════════════════════════════════
doc.add_paragraph()
p('[NAME OF UNIVERSITY]', align='center', bold=True, space_after=0)
p('[College / Department]', align='center', space_after=0)
p('Dumaguete City, Negros Oriental, Philippines', align='center', space_after=24)
p('GUIDEAI: AN OFFLINE-FIRST MOBILE ASSISTIVE APPLICATION FOR VISUALLY IMPAIRED PEDESTRIANS '
  'USING ON-DEVICE YOLO11 OBSTACLE DETECTION, VOICE GUIDANCE, AND EMERGENCY SMS',
  align='center', bold=True, size=15, space_after=24)
p('A Capstone Project', align='center', space_after=0)
p('Presented to the Faculty of the [College / Department]', align='center', space_after=0)
p('[Name of University]', align='center', space_after=24)
p('In Partial Fulfillment of the Requirements for the Degree', align='center', space_after=0)
p('[Bachelor of Science in Information Technology / Computer Science]', align='center', space_after=24)
p('by', align='center', space_after=12)
for i in range(1, 4):
    p(f'[Proponent {i}: Full Name]', align='center', space_after=0)
p('[Month Year]', align='center')

# ═══════════════════════════════════════════════════════════════════════════
# PRELIMINARY PAGES (roman numerals)
# ═══════════════════════════════════════════════════════════════════════════
prelim = doc.add_section(WD_SECTION.NEW_PAGE)
page_numbers(prelim, 'lowerRoman', 1)

front_heading('APPROVAL SHEET')
p('This capstone project entitled "GuideAI: An Offline-First Mobile Assistive Application for Visually '
  'Impaired Pedestrians Using On-Device YOLO11 Obstacle Detection, Voice Guidance, and Emergency SMS," '
  'prepared and submitted by [Proponent names], in partial fulfillment of the requirements for the degree '
  '[Degree Program], has been examined and is recommended for acceptance and approval for ORAL EXAMINATION.')
p('[Name of Adviser]', align='right', bold=True, space_after=0)
p('Capstone Adviser', align='right', space_after=12)
p('PANEL OF EXAMINERS', align='center', bold=True)
p('Approved by the Committee on Oral Examination with a grade of ________.', align='center', space_after=12)
for role in ('Chairperson', 'Member', 'Member'):
    p('[Name of Panelist]', align='center', bold=True, space_after=0)
    p(role, align='center', space_after=8)
p('Accepted and approved in partial fulfillment of the requirements for the degree [Degree Program].',
  space_after=12)
p('[Name of Dean / Program Chair]', align='right', bold=True, space_after=0)
p('[Title]', align='right', space_after=0)
p('Date: ____________', align='right')
page_break()

front_heading('ABSTRACT')
v1, v2 = EVAL[V1], EVAL[V2]
p('Visually impaired pedestrians in Philippine cities face hazards that a white cane alone cannot always '
  'reveal in time: open drainage canals, potholes, stairs, utility poles in the middle of sidewalks, and '
  'tricycles, jeepneys, and motorcycles that share narrow roads with people on foot. Most available '
  'electronic travel aids are expensive, depend on a constant internet connection, or were designed for '
  'other countries. This capstone project developed GuideAI, an Android application that turns an '
  'ordinary smartphone into an assistive device for blind and visually impaired pedestrians in Dumaguete '
  'City. The application detects obstacles in real time with a YOLO11 nano object detection model that runs '
  'entirely on the phone, announces them through short spoken warnings and vibration, reads printed text '
  'with on-device optical character recognition, gives walking directions using OpenStreetMap routing, and '
  'sends emergency text messages with the user\'s location directly from the phone\'s SIM card. An optional '
  'online layer uses Google Gemini to answer free-form voice questions and to name objects outside the '
  'detector\'s classes. The detector was trained on 25,327 images (22,405 training, 1,856 validation, '
  '1,066 test) from nine public datasets of Philippine vehicles, potholes, open drainage, stairs, and '
  'sidewalk obstacles, plus 5,000 everyday scenes from the COCO dataset, covering 25 classes. On the '
  f'held-out test set, the model currently deployed in the application reached a precision of {pct(v1["precision"])}, '
  f'a recall of {pct(v1["recall"])}, and an mAP50 of {pct(v1["mAP50"])}; a retrained model reached an mAP50 of '
  f'{pct(v2["mAP50"])} with a recall of {pct(v2["recall"])}, performing best on tricycles, buses, jeepneys, '
  'people, and cars (mAP50 0.83 to 0.93) and weakest on furniture, animals, and street fixtures that had '
  'little training data. On a mid-range phone (Honor X9a 5G, Android 13) the application analyzed '
  '2.5 to 3.0 camera frames per second with 135 to 215 milliseconds of model time per frame. All 236 '
  'automated software tests passed, and field tests on the phone uncovered and led to the correction of a '
  'false "open drain" warning when the camera was covered. User acceptance testing with visually impaired '
  'participants using the ISO/IEC 25010 quality model is [to be conducted / results summarized here]. '
  'The study shows that real-time, offline obstacle warnings are feasible on an ordinary smartphone, and it '
  'identifies more local training images and the planned smart cane as the main paths to better accuracy.').paragraph_format.line_spacing = 1.0
p('Keywords: assistive technology, visual impairment, YOLO11, on-device object detection, obstacle '
  'detection, text-to-speech, mobile application, Philippines', indent=False, italic=True)
page_break()

front_heading('ACKNOWLEDGEMENT')
p('The proponents wish to express their sincere gratitude to the following people who helped make this '
  'capstone project possible:')
bullets([
    '[Name of Adviser], our capstone adviser, for the guidance, patience, and expert advice throughout the project;',
    'the panel of examiners, [names], for their valuable comments and suggestions;',
    '[Name of partner organization / school for the blind], and the visually impaired participants who '
    'shared their experiences and tested the application;',
    'our families and friends, for their constant support and encouragement; and',
    'above all, the Almighty God, for the wisdom and strength to finish this work.',
])
p('[Proponent names]', align='right')
page_break()

front_heading('TABLE OF CONTENTS')
field(doc.add_paragraph(), 'TOC \\o "1-2" \\h \\z \\u', 'Right-click here and choose Update Field to build the table of contents.')
page_break()
front_heading('LIST OF TABLES')
field(doc.add_paragraph(), 'TOC \\h \\z \\c "Table"', 'Right-click here and choose Update Field.')
page_break()
front_heading('LIST OF FIGURES')
field(doc.add_paragraph(), 'TOC \\h \\z \\c "Figure"', 'Right-click here and choose Update Field.')

# ═══════════════════════════════════════════════════════════════════════════
# MAIN BODY (arabic numerals)
# ═══════════════════════════════════════════════════════════════════════════
body = doc.add_section(WD_SECTION.NEW_PAGE)
page_numbers(body, 'decimal', 1)

# ── CHAPTER I ────────────────────────────────────────────────────────────────
h1('CHAPTER I', 'THE PROBLEM AND ITS BACKGROUND')

h2('Introduction')
p('Independent mobility is one of the greatest challenges faced by people who are blind or visually '
  'impaired. Walking to school, to the market, or to a jeepney stop requires knowing where obstacles are, '
  'where the path drops or rises, and where vehicles are coming from. The World Health Organization (2019) '
  'estimates that at least 2.2 billion people worldwide have a near or distance vision impairment, and '
  'Bourne et al. (2017) estimated 36 million people to be blind in 2015, a number expected to rise as '
  'populations age. For these people, the white cane and the guide dog remain the main mobility aids. The '
  'white cane is reliable for objects on the ground within its reach, but it cannot detect obstacles at '
  'chest or head height, it gives no warning about moving vehicles, and it cannot read signs.')
p('At the same time, the smartphone has become an everyday device even in low- and middle-income countries. '
  'Modern phones contain a camera, a processor able to run neural networks, a microphone, a speaker, a '
  'vibration motor, GPS, and a cellular modem. Recent progress in lightweight object detection models, '
  'especially the YOLO ("You Only Look Once") family (Redmon et al., 2016; Jocher & Qiu, 2024), makes it '
  'possible to recognize objects in a camera image within a fraction of a second on the phone itself, '
  'without sending the image to a server.')
p('This capstone project, GuideAI (internally called BUTA APP, from the Cebuano and Tagalog word for '
  '"blind"), combines these capabilities into a single application designed from the start for blind '
  'users in the Philippines. It warns the user about obstacles and vehicles in front of them, reads text '
  'aloud, gives walking directions, and sends emergency text messages, and it keeps its safety functions '
  'working without an internet connection.')

h2('Background of the Study')
p('Sidewalks in Philippine cities such as Dumaguete are often narrow, uneven, or missing. Pedestrians must '
  'share space with parked motorcycles, vendor carts, utility poles, construction materials, and open '
  'drainage canals. Tricycles and jeepneys, which are common public utility vehicles in the country, '
  'frequently stop or turn close to people on foot. These conditions differ from those assumed by many '
  'assistive navigation products developed abroad, whose object detectors are usually trained on images '
  'of European or American streets and do not know local vehicles such as the tricycle or the jeepney.')
p('Existing assistive applications also tend to depend on a steady internet connection, either because the '
  'image recognition runs on a cloud server or because the user must log in to an account. Mobile data in '
  'the Philippines can be intermittent, and many users rely on prepaid load that can run out. A safety '
  'warning that arrives several seconds late, or not at all because the connection dropped, is of little '
  'use to a person about to step into a canal. Emergency features that send alerts over the internet fail '
  'in exactly the situations where help is needed most.')
p('These observations led the proponents to develop a mobile application whose core safety features run '
  'on the phone itself, which is trained on images of local hazards and vehicles, which can be operated '
  'without looking at the screen, and which uses the internet only for optional extras. The project also '
  'defines the communication protocol for a companion smart cane based on the ESP32 microcontroller, to '
  'be added when the hardware is built.')

h2('Statement of the Problem')
p('This study aimed to design, develop, and evaluate a mobile assistive application that helps visually '
  'impaired pedestrians detect and avoid obstacles and move around more safely and independently. '
  'Specifically, it sought to answer the following questions:')
numbered([
    'What hazards and obstacles commonly encountered by visually impaired pedestrians in Dumaguete City can '
    'be detected by a smartphone camera and an on-device object detection model?',
    'How can an object detection model be trained and optimized to recognize local hazards and vehicles, '
    'such as open drainage, potholes, stairs, tricycles, and jeepneys, and run in real time on a mid-range '
    'Android phone without an internet connection?',
    'How can detected obstacles be communicated to a blind user through speech and vibration in a way that '
    'is timely, prioritized, and not overwhelming?',
    'What supporting functions (text reading, walking navigation, voice commands, and emergency messaging) '
    'should the application provide, and how can they be made fully usable without sight?',
    'How accurate and fast is the developed system, as measured by precision, recall, mean average '
    'precision (mAP), and on-device processing speed?',
    'How do visually impaired users and IT experts evaluate the application in terms of the ISO/IEC 25010 '
    'quality characteristics of functional suitability, performance efficiency, usability, reliability, '
    'and security?',
])

h2('Objectives of the Study')
h3('General Objective')
p('To develop GuideAI, an offline-first Android application that uses on-device YOLO11 object detection, '
  'voice guidance, and emergency SMS to help visually impaired pedestrians in Dumaguete City walk more '
  'safely and independently.')
h3('Specific Objectives')
numbered([
    'To gather and prepare a labeled image dataset of hazards, vehicles, and obstacles relevant to Philippine '
    'streets, including tricycles, jeepneys, potholes, open drainage, stairs, poles, barriers, and carts;',
    'To train a lightweight YOLO11 nano model on this dataset and deploy it on an Android phone so that it '
    'runs without an internet connection;',
    'To design a hazard warning system that estimates the direction and approximate nearness of each '
    'obstacle, confirms detections across camera frames, and speaks short prioritized warnings with '
    'vibration feedback;',
    'To implement accessible supporting modules: on-device text reading, walking navigation with spoken '
    'turn-by-turn directions, bilingual voice commands, and an emergency SOS that sends SMS directly from '
    'the SIM card;',
    'To evaluate the detection model using precision, recall, mAP50, and mAP50-95 on a held-out test set, and '
    'to measure the processing speed of the application on a real phone; and',
    'To evaluate the application with visually impaired users and IT experts using a questionnaire based on '
    'ISO/IEC 25010.',
])

h2('Significance of the Study')
p('The results of this study are expected to benefit the following:')
bullets([
    ('Visually impaired pedestrians. ', 'They gain an affordable tool, running on a phone they may already own, '
     'that warns them about obstacles beyond the reach of the cane, reads text for them, guides them to '
     'places, and lets them call for help even without mobile data.'),
    ('Families and caregivers. ', 'Emergency text messages with a map link let them locate and assist a '
     'family member quickly.'),
    ('Schools and organizations for the blind. ', 'The application can support orientation and mobility '
     'training and give learners more confidence when travelling alone.'),
    ('Local government units. ', 'The hazards most often detected (open drainage, potholes, obstructed '
     'sidewalks) point to infrastructure that needs attention, in support of accessibility laws such as '
     'Republic Act No. 7277 and its amendments.'),
    ('Future researchers. ', 'The dataset preparation scripts, training procedure, evaluation results, and the '
     'documented smart cane protocol can serve as a starting point for related studies.'),
    ('The proponents. ', 'The project applies knowledge in mobile development, machine learning, and '
     'human-centered design to a real social problem.'),
])

h2('Scope and Delimitation')
p('The study covers the design, development, and evaluation of the GuideAI Android application with the '
  'following features:')
bullets([
    'real-time obstacle detection with the phone\'s back camera using a YOLO11 nano model with 25 classes, '
    'running on the phone (person, bicycle, car, motorcycle, tricycle, jeepney, bus, truck, dog, cat, cow, '
    'horse, pothole, open drainage, stairs, pole, barrier, bump, cart, bench, chair, fire hydrant, potted '
    'plant, traffic light, and stop sign);',
    'spoken warnings and vibration, with the direction of the obstacle (left, ahead, right) and a '
    'qualitative nearness band, prioritized by danger;',
    'on-device text reading using Google ML Kit;',
    'walking navigation using OpenStreetMap geocoding and OSRM routing, with spoken turn-by-turn directions;',
    'voice commands with English and Tagalog keywords offline, and an optional Google Gemini assistant that '
    'also understands Cebuano and free-form questions when online;',
    'optional naming of objects outside the 25 classes by Google Gemini when online;',
    'an emergency SOS with a five-second cancellable countdown that sends an SMS with a Google Maps link '
    'directly from the SIM card to saved contacts;',
    'a "Teach My AI" feature that saves pictures for later labeling and retraining on a computer; and',
    'a Bluetooth Low Energy protocol for a companion ESP32 smart cane, with a simulated cane data source in '
    'the application.',
])
p('The study is delimited as follows. The application runs on Android phones only. Obstacle detection '
  'depends on lighting and camera position and works best in daylight with the phone held or worn at chest '
  'height facing forward. The model only recognizes the 25 classes listed; other objects are not detected '
  'by the offline model, although the online Gemini layer may name them. Distances are estimated from the '
  'size and position of objects in the image under an assumed camera height and tilt and are therefore '
  'approximate; the application speaks only nearness bands ("very close", "near", "moderate distance", '
  '"far") rather than exact meters. The smart cane hardware was not built within the study period; only '
  'its communication protocol and the application side were implemented and tested with simulated '
  'readings. The application is an aid to, not a replacement for, the white cane, guide dog, and '
  'orientation and mobility training. It is not a certified medical or navigation device.')

h2('Definition of Terms')
p('The following terms are defined operationally as used in this study:')
terms = [
    ('Bounding box. ', 'The rectangle that an object detection model draws around an object it recognizes.'),
    ('Confidence score. ', 'A number from 0 to 1 that the model gives each detection, showing how sure it is.'),
    ('Edge (on-device) inference. ', 'Running a neural network on the phone itself instead of on a server.'),
    ('EAS Update (over-the-air update). ', 'A way of delivering new application code to installed phones '
     'without reinstalling the application.'),
    ('Gemini. ', 'A family of multimodal AI models by Google, used online in GuideAI for the voice assistant '
     'and for naming unfamiliar objects.'),
    ('mAP50. ', 'Mean average precision at an intersection-over-union threshold of 0.50; the main accuracy '
     'measure for object detectors. mAP50-95 averages this over thresholds from 0.50 to 0.95.'),
    ('OCR (optical character recognition). ', 'Converting printed text in an image into machine-readable text.'),
    ('OSRM. ', 'Open Source Routing Machine, a route planning engine that uses OpenStreetMap data.'),
    ('Precision. ', 'The share of the model\'s detections that are correct.'),
    ('Recall. ', 'The share of the real objects in the images that the model finds.'),
    ('TFLite (TensorFlow Lite). ', 'A compact model format for running neural networks on mobile devices.'),
    ('Text-to-speech (TTS). ', 'Converting text into spoken audio; used for all warnings and messages.'),
    ('TalkBack. ', 'The screen reader built into Android, used by blind people to operate a phone.'),
    ('Visually impaired. ', 'Having low vision or blindness that limits daily activities even with correction.'),
    ('Walking path. ', 'In this study, the central part of the camera image, which the user is walking into.'),
    ('YOLO11n. ', 'The nano (smallest) version of the YOLO11 object detection model by Ultralytics.'),
]
bullets(terms)

# ── CHAPTER II ───────────────────────────────────────────────────────────────
page_break()
h1('CHAPTER II', 'REVIEW OF RELATED LITERATURE AND STUDIES')
p('This chapter presents literature and studies related to visual impairment, assistive navigation '
  'technologies, object detection, and the other technologies used in GuideAI, which guided the design of '
  'the system.')

h2('Visual Impairment and Mobility')
p('The World Health Organization (2019), in its World Report on Vision, states that at least 2.2 billion '
  'people have a vision impairment, of whom at least one billion have an impairment that could have been '
  'prevented or has yet to be addressed. A systematic review and meta-analysis by Bourne et al. (2017) '
  'estimated that 36 million people were blind and 217 million had moderate to severe vision impairment in '
  '2015, with the largest numbers in South and East Asia, and projected substantial increases by 2050 due '
  'to population growth and ageing. Vision impairment strongly affects the ability to travel independently, '
  'to work, and to take part in community life, which makes safe mobility a central goal of rehabilitation.')

h2('Assistive Navigation Technologies')
p('Dakopoulos and Bourbakis (2010) surveyed wearable electronic travel aids for the blind, including '
  'ultrasonic canes, laser devices, and camera-based systems. They found that most devices could detect '
  'obstacles but were limited by cost, weight, short battery life, and feedback that was difficult to '
  'interpret, and that few had been evaluated with blind users in real conditions. Real and Araujo (2019) '
  'reviewed navigation systems for the blind and visually impaired and identified obstacle detection, '
  'localization, and user interface design as the main open problems, noting that systems should '
  'complement, not replace, the white cane. Kuriakose et al. (2022) reviewed tools and technologies for '
  'navigation support and highlighted smartphones as promising platforms because they are widely owned and '
  'already contain the necessary sensors, while also pointing out that many smartphone solutions depend on '
  'internet connectivity and have not been tested with users.')
p('These reviews informed three design decisions in GuideAI: running the core detection offline on the '
  'phone, keeping the warnings short and prioritized so they do not overwhelm the user, and designing the '
  'application so that it supports the cane rather than replacing it. They also motivated the companion '
  'smart cane, which adds ground-level drop detection that a forward-facing camera cannot provide.')

h2('Deep Learning Object Detection')
p('Redmon et al. (2016) introduced YOLO (You Only Look Once), which frames object detection as a single '
  'regression problem: one pass of a convolutional neural network predicts bounding boxes and class '
  'probabilities for the whole image. This made real-time detection possible and started a family of '
  'models that has been improved many times. Liu et al. (2016) proposed the Single Shot MultiBox Detector '
  '(SSD), another one-stage detector, and Howard et al. (2017) introduced MobileNets, efficient network '
  'designs for mobile and embedded vision applications. Together these works established that accurate '
  'object detection can run on devices with limited computing power.')
p('Ultralytics YOLO11 (Jocher & Qiu, 2024) is a recent member of the YOLO family. Khanam and Hussain (2024) '
  'describe its key architectural changes, including improved feature extraction blocks and attention '
  'components, which give better accuracy with fewer parameters than earlier versions. The nano variant, '
  'YOLO11n, is small enough to run on a phone. Models of this family are usually first trained on the COCO '
  'dataset (Lin et al., 2014), which contains about 330,000 images of everyday scenes labeled with 80 object '
  'categories, and are then fine-tuned on task-specific data. GuideAI follows this transfer learning '
  'approach: a COCO-pretrained YOLO11n was fine-tuned on Philippine street hazards and vehicles.')

h2('Multi-Object Tracking')
p('Detections from single frames tend to flicker: an object may be found in one frame and missed in the '
  'next. Bewley et al. (2016) proposed SORT (Simple Online and Realtime Tracking), which links detections '
  'across frames by the overlap of their boxes. Zhang et al. (2022) proposed ByteTrack, which improves '
  'tracking by also using low-confidence detections to keep existing tracks alive while never starting new '
  'tracks from them. GuideAI uses a lightweight tracker in the same spirit: an object must be seen in two '
  'of the last three frames before it is announced, low-confidence detections may keep a known object '
  'alive, and growth of an object\'s box over about one second marks it as approaching.')

h2('Vision-Language Models')
p('Large multimodal models can describe images and answer questions about them in natural language. '
  'Google\'s Gemini models accept images and text and can return the locations of objects as bounding boxes '
  '(Google AI for Developers, n.d.). Such models recognize a far wider range of objects than a 25-class '
  'detector, but they require an internet connection, respond in seconds rather than milliseconds, and '
  'can be wrong. For these reasons GuideAI uses Gemini only as an optional online layer for naming '
  'unfamiliar objects and for the voice assistant, while all safety warnings come from the offline detector.')

h2('Text Recognition, Routing, and Speech')
p('Google ML Kit provides on-device text recognition for mobile applications (Google, n.d.), which allows '
  'printed text to be read without an internet connection. Luxen and Vetter (2011) presented the Open '
  'Source Routing Machine (OSRM), which computes routes on OpenStreetMap data in real time; GuideAI uses its '
  'walking profile to give turn-by-turn directions. Both technologies are free to use, which keeps the '
  'application affordable.')

h2('Accessibility Standards and Philippine Laws')
p('The Web Content Accessibility Guidelines (WCAG) 2.1 (World Wide Web Consortium, 2018) set out '
  'principles for accessible digital content, including sufficient color contrast, text alternatives for '
  'non-text content, and operability without precise pointing. GuideAI applies these to a mobile '
  'application: every control has a screen reader label, touch targets are large, and every function can '
  'be used by voice. In the Philippines, Republic Act No. 7277, the Magna Carta for Disabled Persons (1992), '
  'as amended by Republic Act No. 9442 (2007), promotes the rehabilitation, self-development, and '
  'integration of persons with disabilities into mainstream society. Republic Act No. 10173, the Data '
  'Privacy Act of 2012, governs the processing of personal information; GuideAI keeps names, contacts, and '
  'settings on the phone, has no user accounts, and tells the user when a picture is sent to an online service.')

h2('Related Local Studies')
p('[To be completed by the proponents: summarize two to five related capstone projects, theses, or '
  'journal articles by Filipino researchers on assistive technology for the visually impaired, obstacle '
  'detection, or smart canes, from your university library or Philippine journals. For each, give the '
  'author, year, what was developed, the results, and how GuideAI differs. Add each one to the References.]',
  italic=True)

h2('Synthesis')
p('The reviewed literature shows that (a) vision impairment is widespread and mobility is one of its most '
  'limiting effects; (b) electronic travel aids can extend the protection of the white cane, but many are '
  'costly, depend on the internet, or are hard to use; (c) one-stage detectors such as YOLO11 make '
  'real-time object detection possible on ordinary phones, especially when fine-tuned on task-specific '
  'data; (d) tracking across frames reduces flickering and false alarms; and (e) online multimodal models '
  'recognize many more objects but are slower and less reliable for safety warnings. GuideAI builds on '
  'these findings. Unlike the systems reviewed, it is trained on Philippine hazards and vehicles, keeps its '
  'safety functions offline, sends emergency messages through the SIM card, and treats online AI as an '
  'optional extra rather than a dependency.')

h2('Conceptual Framework')
p('The conceptual framework of the study follows the Input-Process-Output model shown in Table 1.')
table(['Input', 'Process', 'Output'], [[
    'Knowledge requirements: needs of visually impaired pedestrians; common hazards in Dumaguete City; '
    'accessibility guidelines; YOLO object detection; Android development.\n\n'
    'Software requirements: React Native / Expo; YOLO11 (Ultralytics); TensorFlow Lite; ML Kit; OSRM; '
    'Google Gemini API.\n\n'
    'Hardware requirements: Android phone; laptop with an NVIDIA GPU for training; ESP32 and sensors '
    '(planned smart cane).\n\n'
    'Data: 25,327 labeled images from public datasets and COCO.',
    'Requirements gathering and analysis\n\nDataset collection, merging, and labeling\n\nModel training, '
    'evaluation, and export to TFLite\n\nIterative design and development of the mobile application '
    '(detection, warnings, text reader, navigation, voice, SOS)\n\nUnit testing, model testing, and field '
    'testing on phones\n\nEvaluation with users and IT experts (ISO/IEC 25010)',
    'GuideAI: an offline-first Android assistive application for visually impaired pedestrians with real-time '
    'obstacle warnings, text reading, walking navigation, voice commands, and emergency SMS\n\nTrained '
    'YOLO11n model for 25 Philippine street classes\n\nSmart cane communication protocol',
]], [1.95, 2.0, 2.05], title='Input-Process-Output conceptual framework of the study')

# ── CHAPTER III ──────────────────────────────────────────────────────────────
page_break()
h1('CHAPTER III', 'METHODOLOGY')
p('This chapter describes the research design, the development process, the system architecture, the '
  'dataset and model training, the design of each module, and the methods used to test and evaluate GuideAI.')

h2('Research Design')
p('The study used a developmental (applied) research design, which aims to create and validate a product '
  'that solves a practical problem. Quantitative methods were used to evaluate the detection model '
  '(precision, recall, mAP) and the application\'s speed, and a descriptive survey based on ISO/IEC 25010 '
  'is used to evaluate the quality of the application as perceived by users and IT experts.')

h2('Software Development Methodology')
p('The application was built with an iterative, Agile-style prototyping approach. Each cycle produced a '
  'working version that was installed on real phones, tested, and improved based on what was observed. '
  'New versions of the application code were delivered to the test phones through over-the-air updates '
  '(EAS Update), which made it possible to fix problems found in field tests within the same day. The main '
  'phases were:')
numbered([
    'Requirements analysis: identifying user needs, common hazards, and accessibility requirements, and '
    'deciding that the application must work without login and without internet for its safety functions.',
    'Design: defining the architecture, the screens (four tabs and an always-available SOS), and the voice '
    'and vibration feedback rules.',
    'Data preparation and model training: collecting and merging datasets, training and evaluating the '
    'YOLO11n model, and exporting it to TFLite.',
    'Development: implementing each module in React Native (Expo) with TypeScript, with native modules for '
    'the camera, the neural network, speech, and SMS.',
    'Testing: automated unit tests for the logic, accuracy tests for the model, and field tests on phones.',
    'Deployment and evaluation: building the installable APK, distributing updates, and evaluating the '
    'application with users and experts.',
])

h2('System Architecture')
p('Figure 1 shows the architecture of GuideAI. All modules inside the phone boundary work without an '
  'internet connection. The camera passes frames to the YOLO11n model, whose detections go through the '
  'tracker and hazard classifier to the hazard announcer, which decides what to say and drives the '
  'text-to-speech engine and the vibration motor. The text reader, navigation, voice commands, and '
  'emergency SOS are separate modules that share the speech engine and on-device storage. Online services '
  '(Google Gemini, OpenStreetMap geocoding and routing) and the planned smart cane are optional.')
figure('fig_architecture.png', 'System architecture of GuideAI', width=6.0)

h2('System Diagrams')
p('The use-case diagram of GuideAI and its entity-relationship diagram are presented in Appendix G.')

h2('Hardware and Software Requirements')
table(['Component', 'Specification used in the study'], [
    ['Test phone 1', 'Honor X9a 5G (RMO-NX1), Android 13'],
    ['Test phone 2', 'Realme RMX3171, Android 11'],
    ['Minimum phone', 'Android 7.0 or newer with a rear camera (the application is built for Android API level 24+)'],
    ['Training computer', 'Laptop with an NVIDIA GeForce RTX 2050 GPU, Windows 11'],
    ['Planned smart cane', 'ESP32 microcontroller, RCWL-1601 ultrasonic sensor, VL53L0X laser distance sensor, '
     'MPU6050 motion sensor, coin vibration motor, buzzer'],
], [1.8, 4.2], title='Hardware used in the study')
table(['Component', 'Technology and version'], [
    ['Mobile framework', 'React Native 0.86 with Expo SDK 57, TypeScript'],
    ['Camera', 'react-native-vision-camera 5.2.3 (frame processing on a separate thread)'],
    ['Neural network runtime', 'react-native-fast-tflite 3.0.1 (TensorFlow Lite)'],
    ['Object detection model', 'Ultralytics YOLO11n, fine-tuned (Ultralytics 8.4, PyTorch 2.6 with CUDA 12.4)'],
    ['Model conversion', 'ONNX, then onnx2tf to TensorFlow Lite (float32, 320 x 320 input)'],
    ['Text recognition', 'Google ML Kit text recognition (on-device)'],
    ['Speech', 'expo-speech (text-to-speech), expo-speech-recognition (speech-to-text, en-PH)'],
    ['Navigation', 'Device GPS, Photon and Nominatim geocoding, OSRM walking routes (OpenStreetMap)'],
    ['Online AI (optional)', 'Google Gemini API (gemini-3.5-flash-lite)'],
    ['Emergency SMS', 'Custom Expo native module using the Android SmsManager'],
    ['State and storage', 'Zustand, AsyncStorage, expo-file-system (all on the phone)'],
    ['Testing', 'Jest (jest-expo) for automated tests'],
    ['Build and updates', 'Expo Application Services (EAS Build for the APK, EAS Update for updates)'],
], [1.8, 4.2], title='Software and technologies used')

h2('Dataset Collection and Preparation')
p('No single public dataset covered the hazards and vehicles of Philippine streets, so nine public '
  'datasets were merged into one dataset with a unified list of 25 classes (Table 4). Each source\'s labels '
  'were renamed to the unified class names; labels that should not be learned (for example, closed manhole '
  'covers or whole "footpath" regions) were removed while keeping the image as a background example; and '
  'large sources were capped so that no single source dominated. Images were resized so that their longer '
  'side was at most 416 pixels. Because the street datasets contained no furniture, animals, or indoor '
  'scenes, 5,000 images from the COCO 2017 dataset were added for the second training round. Everyday '
  'objects in these images (people, vehicles, dogs, cats, chairs, and so on) were labeled automatically by '
  'a larger YOLO11m "teacher" model (pseudo-labeling), and the COCO images also taught the model what '
  'ordinary rooms look like, to reduce false alarms such as a laptop screen being called a car.')
table(['Source (internal name)', 'Content', 'Train', 'Val', 'Test'], [
    ['ph_vehicles', 'Philippine road vehicles (tricycles, jeepneys, cars, motorcycles, buses, trucks)', '3,500', '250', '250'],
    ['ph_tricycle_niluto', 'Philippine tricycles', '225', '65', '32'],
    ['open_manhole', 'Open manholes and drainage openings', '2,500', '14', '18'],
    ['pothole_ivcnz', 'Road potholes', '1,060', '94', '89'],
    ['stairs_rf1', 'Stairs (boxes)', '2,000', '250', '177'],
    ['stairs_rf2', 'Stairs (boxes)', '1,384', '183', '-'],
    ['stairs_lines', 'Stairs (stair-edge lines converted to boxes)', '2,000', '250', '-'],
    ['vip_navigation_bd', 'Street scenes for visually impaired navigation (poles, barriers, carts, people, vehicles)', '4,236', '250', '250'],
    ['vip_obstacles', 'Sidewalk obstacles', '1,000', '250', '-'],
    ['COCO 2017 (subset)', 'Everyday indoor and outdoor scenes, pseudo-labeled', '4,500', '250', '250'],
    ['Total', '', '22,405', '1,856', '1,066'],
], [1.45, 2.65, 0.65, 0.6, 0.65], title='Image sources of the merged dataset', size=9)
p('Note: the original download links and licenses of each public dataset are listed in Appendix F.',
  indent=False, italic=True, size=10)

h2('Model Training')
p('Training was done on the laptop GPU with the Ultralytics framework. The model started from YOLO11n '
  'weights pretrained on COCO and was fine-tuned on the merged dataset with the settings in Table 5. The '
  'first model (v1) was trained for 60 epochs and is the model currently installed in the application. A '
  'second model (v2) continued from v1 with the COCO images added; it was planned for 45 epochs but the '
  'training was interrupted after epoch 37, and its best checkpoint is evaluated in Chapter IV. Figure 2 '
  'shows the validation mAP50 of both runs per epoch. The two validation sets differ (v2\'s includes COCO '
  'images), so the curves are not directly comparable; the fair comparison on a common test set is in '
  'Chapter IV.')
table(['Setting', 'Value'], [
    ['Base model', 'YOLO11n pretrained on COCO (v2: continued from v1)'],
    ['Input size', '320 x 320 pixels'],
    ['Batch size', '32'],
    ['Epochs', 'v1: 60; v2: 45 planned, stopped after 37'],
    ['Optimizer / initial learning rate', 'MuSGD (Ultralytics automatic choice) / 0.01'],
    ['Early stopping patience', '15 epochs'],
    ['Augmentation', 'Ultralytics defaults (mosaic, scaling, translation, HSV color, horizontal flip)'],
    ['Hardware', 'NVIDIA GeForce RTX 2050 laptop GPU'],
], [2.4, 3.6], title='Training settings')
figure('fig_training_curves.png', 'Validation mAP50 per epoch for the two training runs', width=5.8)

h2('Model Export and Deployment')
p('The trained PyTorch model was exported to ONNX and converted to TensorFlow Lite (float32) with an input '
  'of 320 by 320 pixels, then bundled with the application. On the phone, camera frames are converted on '
  'a separate thread into a 320 by 320 "letterboxed" image (scaled without stretching and padded with '
  'gray, the same way as in training), so that only a small image crosses into the application code. '
  'The model\'s raw output is decoded into boxes, filtered by a per-class confidence threshold (lower for '
  'dangerous classes such as open drainage, potholes, and stairs; higher for people and furniture), and '
  'cleaned with class-aware non-maximum suppression.')

h2('Obstacle Detection and Warning Pipeline')
p('Figure 3 shows the steps from a camera frame to a spoken warning. About three frames per second are '
  'analyzed, which is enough for walking speed and keeps battery use and heat low.')
figure('fig_pipeline.png', 'Obstacle detection and warning pipeline', width=3.6)
bullets([
    ('View check. ', 'Each frame is checked for darkness and lack of detail. If the camera is covered or in '
     'the dark, the application reports nothing and says "Camera view is too dark or covered," so that an '
     'empty result is never mistaken for a clear path.'),
    ('Full-frame guess filter. ', 'A low-confidence box that covers nearly the whole picture is ignored, '
     'because it is almost always the model guessing at a blank view.'),
    ('Tracking. ', 'An object is announced only after it is seen in two of the last three frames (very '
     'confident detections skip the wait). A confirmed object missed for one frame is kept, and boxes are '
     'smoothed over frames. If an object\'s box grows by 15 percent within about 1.2 seconds, it is marked '
     'as approaching, and a moving hazard that approaches is raised one danger level.'),
    ('Direction and nearness. ', 'The horizontal position of the box gives the direction (left, ahead, '
     'right). An approximate distance is estimated from the box size using typical real-world heights, or '
     'from where the object touches the ground for flat hazards such as potholes, under an assumed camera '
     'height of 1.3 m and tilt of 15 degrees. Because this estimate is uncalibrated, it is used only to rank '
     'hazards and is never spoken as meters.'),
    ('Walking-path relevance. ', 'Objects off to the side, far away, and not approaching are shown on '
     'screen but not spoken, so that the user is not overwhelmed by every parked car or distant person.'),
])

h2('Voice Warning Design')
p('Warnings were kept short and consistent so that they can be understood quickly while walking. Stairs, '
  'vehicles, people, and animals are named, because knowing what they are changes what the user should '
  'do; all other objects are announced as "obstacle". A class is named only if the model is at least 50 '
  'percent confident, so that, for example, a tiled floor that slightly resembles stairs is never called '
  '"stairs". The rules are summarized in Table 6.')
table(['Detected class', 'Spoken warning (example)', 'Voice priority'], [
    ['stairs', '"Careful, stairs ahead."', '1 (highest)'],
    ['pothole, open drainage', '"Careful, obstacle ahead."', '1'],
    ['car, motorcycle, truck, bus, bicycle, tricycle, jeepney', '"Careful, car on your right."', '2'],
    ['person, dog, cat, cow, horse', '"Careful, person ahead."', '3'],
    ['chair, bench, pole, barrier, cart, bump, others', '"Careful, obstacle on your left."', '4'],
], [2.6, 2.3, 1.1], title='Voice warning rules')
p('Several hazards seen at the same time are combined into one sentence, most important first, for example '
  '"Careful, stairs ahead. Also car on your left." The same warning is not repeated within five seconds '
  'unless the hazard becomes more dangerous (higher risk, approaching, or very close). A warning that is '
  'being spoken is allowed to finish, unless a hazard with a higher voice priority appears, which then '
  'interrupts it. Vibration is given immediately even when the spoken warning has to wait: at the default '
  'strength, three strong pulses for critical hazards, two for warnings, and one light pulse for information.')

h2('Supporting Modules')
h3('Text Reader')
p('The user points the camera at printed text and taps the large Read Text button. Google ML Kit '
  'recognizes the text on the phone, and the text is read aloud as natural sentences. When online, the '
  'user can also ask for a description of the scene, which is answered by Google Gemini.')
h3('Walking Navigation')
p('The user chooses or speaks a destination. Common places in Dumaguete City are stored in the application; '
  'other places are found with the Photon and Nominatim geocoders. A walking route is computed with OSRM, '
  'and spoken directions are given with the live distance to each turn, a heads-up 30 meters before the '
  'turn, and automatic rerouting when the user leaves the route. The user is asked to confirm before '
  'starting a walk longer than 5 kilometers. "Where am I?" speaks the current street and area.')
h3('Voice Commands and Assistant')
p('A large Voice Command button starts speech recognition (Philippine English). Commands are matched '
  'offline against English and Tagalog keywords (for example "navigate to the market", "nasaan ako", '
  '"basahin", "tulong"). When online, free-form requests in English, Tagalog, or Cebuano are understood by '
  'Google Gemini, which chooses the action and gives a short spoken reply. Emergency and stop commands are always handled offline and '
  'never depend on the online assistant.')
h3('Emergency SOS')
p('The SOS button is always visible on the home screen. Pressing it starts a five-second spoken countdown '
  'that can be cancelled. When the countdown ends, the application gets the GPS location and sends this '
  'message directly from the SIM card to every saved emergency contact: "EMERGENCY: [name] needs help near '
  '[area]. Location: https://maps.google.com/?q=[latitude],[longitude] - sent by GuideAI, an app for the '
  'visually impaired." The message uses plain characters so that it fits in a single SMS. Philippine '
  'emergency hotlines (911, 117, 143, 160) are listed for one-tap calling.')
h3('AI Object Names (Optional, Online)')
p('Every 6 to 20 seconds while the camera is active and the phone is online, one sharper picture '
  '(512 pixels) is sent to Google Gemini, which returns the names and boxes of the objects it sees. A name '
  'that matches a tracked detection refines its label on screen (for example, "chair" with "AI: monobloc '
  'chair"); objects the offline model has no class for are shown with dashed boxes. AI names are marked '
  'as such and shown without a percentage, because the AI\'s certainty is not a calibrated score. The '
  'online layer never triggers or silences a safety warning, it pauses while the camera cannot see, and '
  'it can be turned off in Settings.')
h3('Teach My AI')
p('When turned on, the application saves pictures in which the model was unsure, plus one picture a minute '
  'to catch missed objects, and shows a Teach button that saves the current view with a name typed by a '
  'helper. The pictures stay on the phone until copied to a computer, where a script imports them for '
  'checking in a labeling tool, validates the labels, and adds them to the training set, keeping pictures '
  'taken within the same few minutes in the same split so that near-identical frames do not inflate the '
  'test results. Nothing is retrained automatically.')
h3('Smart Cane Protocol')
p('The companion cane is defined as a Bluetooth Low Energy peripheral that sends front (ultrasonic) and '
  'ground (laser) distances about ten times per second, plus button and fall events (Appendix C). The '
  'application learns the normal ground distance while walking and warns of a drop when the ground is 25 cm '
  'farther than normal for two readings in a row, of a step or curb when it is 20 cm closer, and of an '
  'obstacle at chest height within 150 cm (stop within 70 cm). The cane must also warn on its own with its '
  'vibration motor and buzzer if the phone is unavailable.')

h2('Accessibility Design')
bullets([
    'The application is organized into four tabs (Home, Detect, Navigate, Read) with large buttons and an '
    'always-visible SOS button.',
    'Every control has a TalkBack label and hint, touch targets are at least 48 by 48 density-independent '
    'pixels, and the dark theme uses high-contrast text.',
    'Each screen announces itself when opened; obstacle detection starts automatically when the Detect tab '
    'is opened, and tapping anywhere on the camera view pauses or resumes it.',
    'Settings are saved immediately, with no Save button to find; speech speed, voice accent (Philippine '
    'English by default), and vibration strength are adjustable.',
    'There is no login and no account; the screen stays awake during detection so that warnings continue.',
])

h2('Testing and Evaluation')
h3('Automated Software Testing')
p('The logic of the application (detection decoding, tracking, distance bands, warning rules, voice '
  'command parsing, navigation formatting, contact validation, SMS text, the AI identification merger, and '
  'others) was covered by automated unit tests written with Jest and run after every change.')
h3('Model Evaluation')
p('The models were evaluated on the held-out test split of 1,066 images that were not used in training. '
  'The following standard metrics were computed, where TP, FP, and FN are true positives, false positives, '
  'and false negatives at an intersection-over-union (IoU) threshold:')
bullets([
    'Precision = TP / (TP + FP)',
    'Recall = TP / (TP + FN)',
    'AP: the area under the precision-recall curve for one class; mAP50 is the mean AP over classes at '
    'IoU 0.50, and mAP50-95 is the mean over IoU thresholds from 0.50 to 0.95 in steps of 0.05.',
])
h3('On-Device Performance and Field Testing')
p('The frames analyzed per second and the time the model takes per frame were measured inside the '
  'application from real timestamps and shown on the detection screen. Field tests were performed on the '
  'test phones by pointing the camera at people, furniture, laptops, classrooms, and covered views, while '
  'screenshots were captured over USB.')
h3('User Acceptance Evaluation')
p('The quality of the application is evaluated with a questionnaire based on the ISO/IEC 25010 quality '
  'model (Appendix A), covering functional suitability, performance efficiency, usability, reliability, '
  'and security. For visually impaired respondents, the questions are read aloud and answers are recorded '
  'by a facilitator. Each item is rated on a five-point Likert scale, and the weighted mean of each '
  'characteristic is interpreted with the scale in Table 7.')
table(['Scale', 'Range of weighted mean', 'Verbal interpretation'], [
    ['5', '4.21 - 5.00', 'Strongly Agree (Excellent)'],
    ['4', '3.41 - 4.20', 'Agree (Very Good)'],
    ['3', '2.61 - 3.40', 'Neutral (Good)'],
    ['2', '1.81 - 2.60', 'Disagree (Fair)'],
    ['1', '1.00 - 1.80', 'Strongly Disagree (Poor)'],
], [1.0, 2.2, 2.8], title='Likert scale and interpretation')
p('Weighted mean = Σ(f × w) / N, where f is the number of respondents who chose a rating, w is the rating '
  '(1 to 5), and N is the total number of respondents. Respondents: [number] visually impaired '
  'participants from [organization], selected by purposive sampling, and [number] IT experts.')

h2('Ethical Considerations')
bullets([
    'Participants will take part voluntarily after informed consent is explained verbally, and may stop at '
    'any time. Field tests with blind participants are done in safe areas with a sighted companion.',
    'The application stores the user\'s name, emergency contacts, and settings only on the phone. There are '
    'no accounts and no central database, in line with the Data Privacy Act of 2012.',
    'When the optional online features are used, a camera picture or the spoken request is sent to Google '
    'Gemini; this is disclosed in Settings and can be turned off.',
    'The application states that it is an assistive aid and does not guarantee safety; users are reminded '
    'to keep using their cane.',
])

# ── CHAPTER IV ───────────────────────────────────────────────────────────────
page_break()
h1('CHAPTER IV', 'RESULTS AND DISCUSSION')
p('This chapter presents the developed system and the results of the model evaluation, on-device '
  'performance measurements, software and field tests, and user evaluation, organized according to the '
  'specific problems in Chapter I.')

h2('The Developed System')
p('GuideAI was developed and installed on two Android phones as a release APK, with later changes delivered '
  'through over-the-air updates. Figures 4 to 6 show its main screens as captured from the test phone.')
figures_row([('scr_home.png', 'Home'), ('scr_voice.png', 'Voice command'), ('scr_settings.png', 'Settings')])
caption('Figure', 'Home, voice command, and settings screens')
figures_row([('scr_detect_person.png', 'Person detected ahead'), ('scr_detect_clear.png', 'Laptop: no false alarm'),
             ('scr_detect_dark.png', 'Camera covered')])
caption('Figure', 'Obstacle detection screen in three situations (field test, 17 October 2026)')
figures_row([('scr_navigate.png', 'Choose destination'), ('scr_read.png', 'Text reader'), ('scr_sos.png', 'Emergency SOS')])
caption('Figure', 'Navigation, text reader, and emergency SOS screens')
p('The detection screen (Figure 5) shows the live camera view with a box and label for each detected '
  'object, including the model\'s confidence and the nearness band, a status strip with the number of '
  'objects and the measured speed, and left/ahead/right indicators colored by the most serious hazard on '
  'each side. These visual elements are for sighted helpers and testers; the blind user receives the same '
  'information through speech and vibration.')

h2('Model Performance')
p('Table 8 compares the two trained models on the same held-out test set of 1,066 images with 3,451 '
  'labeled objects. The retrained model (v2) found considerably more of the objects (recall '
  f'{pct(v2["recall"])} versus {pct(v1["recall"])}) and achieved a higher mAP50 ({pct(v2["mAP50"])} versus '
  f'{pct(v1["mAP50"])}) and mAP50-95 ({pct(v2["mAP50_95"])} versus {pct(v1["mAP50_95"])}). Its precision '
  f'was lower ({pct(v2["precision"])} versus {pct(v1["precision"])}), which is expected: v1 rarely predicted '
  'the classes it had no training data for, so the few predictions it made were more often correct, while '
  'v2 now attempts these classes. On the training laptop\'s GPU, both models took about 2.2 to 2.4 '
  'milliseconds per image.')
table(['Model', 'Precision', 'Recall', 'mAP50', 'mAP50-95'], [
    ['v1 (installed in the application)', pct(v1['precision']), pct(v1['recall']), pct(v1['mAP50']), pct(v1['mAP50_95'])],
    ['v2 (retrained with COCO images, epoch 37 of 45)', pct(v2['precision']), pct(v2['recall']), pct(v2['mAP50']), pct(v2['mAP50_95'])],
], [2.7, 0.8, 0.8, 0.8, 0.9], title='Overall detection accuracy on the test set (1,066 images)')
rows = []
for c in sorted(EVAL[V2]['per_class'], key=lambda k: -EVAL[V2]['per_class'][k]['mAP50']):
    a, b = EVAL[V1]['per_class'].get(c, {}), EVAL[V2]['per_class'][c]
    rows.append([c, pct(a.get('mAP50', 0)), pct(b['precision']), pct(b['recall']), pct(b['mAP50'])])
table(['Class', 'v1 mAP50', 'v2 precision', 'v2 recall', 'v2 mAP50'], rows,
      [1.7, 1.0, 1.1, 1.0, 1.0], title='Per-class test results, sorted by v2 mAP50', size=9)
figure('fig_per_class.png', 'Per-class test mAP50 of the two models', width=5.3)
p('The per-class results (Table 9 and Figure 7) show three groups. The model is strong on Philippine '
  'vehicles and people: tricycles, buses, jeepneys, people, cars, and carts reach an mAP50 of 0.80 to '
  '0.93, and motorcycles and trucks around 0.68 to 0.73. It is moderate on stairs (0.74), poles (0.65), and '
  'potholes (0.52), which are among the most important hazards. It is weak on open drainage (0.33) and '
  'barriers (0.23), and on the classes that had no labeled examples in the street datasets: chairs, '
  'benches, cats, cows, fire hydrants, and stop signs (0.00 to 0.19). v1 had essentially no ability to '
  'detect these, and the COCO images added in v2 raised dogs to 0.49, horses to 0.36, and potted plants to '
  '0.32, but furniture remains poor. This matches what was seen in field tests, where a classroom full of '
  'chairs and tables produced no detections except the nearest person.')
p('Two cautions apply to these numbers. First, the 250 COCO test images were labeled by the YOLO11m teacher '
  'model, not by people, so results for everyday classes are measured against automatic labels. Second, '
  'open drainage had only 18 test images and fire hydrants, stop signs, and some animals had very few, so '
  'their results are uncertain. More hand-labeled local images, especially of open drainage, barriers, '
  'furniture, and stairs in Dumaguete, are the most direct way to improve accuracy.')
figure('fig_confusion_v1.png', 'Normalized confusion matrix of model v1 on the validation set', width=5.0)

h2('On-Device Performance')
p('Table 10 summarizes the speed measured inside the application on the Honor X9a 5G during the field '
  'tests. The application deliberately analyzes a frame about every 350 milliseconds, so the analysis rate '
  'of 2.5 to 3.0 frames per second is close to its designed maximum, with model time well below the '
  'interval. The online object naming answered in 1.6 to 2.4 seconds when tested on sample photos after '
  'reducing the model\'s reasoning setting (it took 9 to 14 seconds with the default setting); it runs '
  'alongside the offline detection and never delays the warnings.')
table(['Measure', 'Result'], [
    ['Frames analyzed per second (measured in the app)', '2.5 - 3.0'],
    ['Model time per frame on the phone (measured in the app)', '135 - 215 ms'],
    ['Model time per image on the training GPU (RTX 2050)', '2.2 - 2.4 ms'],
    ['Online object naming (Gemini), per picture', '1.6 - 2.4 s (sample photos, PC test)'],
    ['Model file size', 'TFLite float32, 320 x 320 input'],
], [3.8, 2.2], title='On-device performance (Honor X9a 5G, Android 13)')

h2('Software Testing')
p('All 236 automated tests in 15 test suites passed on the final version of the application. Table 11 '
  'lists the main areas covered.')
table(['Area', 'Examples of what is tested'], [
    ['Detection decoding', 'YOLO output decoding, letterbox coordinates, non-maximum suppression, label sets'],
    ['Tracking and risk', 'two-of-three confirmation, approaching detection, low-confidence rescue, box smoothing, walking-path relevance'],
    ['Distance and view', 'nearness bands, camera dark/covered check, full-frame guess filter'],
    ['Voice warnings', 'class-to-speech rules, voice priority, combining, repeat suppression, interruptions'],
    ['Voice commands', 'English/Tagalog/Cebuano intent matching, Gemini reply validation, offline fallback'],
    ['Navigation', 'route step formatting, distance and duration wording, off-route distance'],
    ['Emergency', 'Philippine phone number validation, SMS message format'],
    ['AI identification', 'parsing Gemini boxes, matching to YOLO objects, scene-change handling, JPEG encoding'],
    ['Teach My AI', 'picture saving rules, BMP encoding, suggestion files'],
], [1.7, 4.3], title='Areas covered by the automated tests')

h2('Field Testing on the Phone')
p('Field tests on the phone revealed problems that the automated tests could not, which were fixed and '
  're-tested. Table 12 lists the test cases and observed results.')
table(['Test case', 'Expected', 'Observed result'], [
    ['Person in front of the camera', 'Person detected; warning spoken', 'Detected ("person 59% · near", ahead); warning spoken'],
    ['Laptop screen filling the view', 'No false vehicle', 'Earlier test (13 Oct): v1 called a laptop a "car". 17 Oct, v1 with the full-frame filter: 0 objects, "Path Clear"'],
    ['Phone lying face down', '"Camera can\'t see", no hazard', 'First test: false "Open drain ahead, very close" for 40+ s. Fixed: no detections while the view is dark; re-test showed 0 objects and the warning'],
    ['Classroom with chairs, tables, students', 'Obstacles detected', 'Only the nearest person detected; chairs and tables missed (model limitation)'],
    ['Moving the camera to a new view', 'Old AI boxes removed', 'First test: AI boxes stayed over a blank wall. Fixed with scene-change detection; re-scan in about 1.5 s'],
    ['AI object naming on sample photos', 'Correct names and boxes', 'Tricycles, motorcycle, cars, pothole, stairs boxed correctly (Figure 8)'],
    ['Text reader on a printed label', 'Text read aloud', '[To be recorded during the evaluation]'],
    ['Navigation to a stored place', 'Route and spoken steps', 'Route found and steps shown on screen; spoken guidance while walking: [to be recorded]'],
    ['Emergency SOS', 'Countdown, SMS sent', 'Countdown and screen verified; [real SMS delivery test: to be recorded]'],
], [1.6, 1.5, 2.9], title='Field test cases and results', size=9)
figure('fig_gemini_boxes.png', 'Objects found and named by the online AI layer on sample test photos', width=3.0)

h2('User Acceptance Evaluation')
p('[To be completed after the evaluation. Present the respondents, then the weighted mean and '
  'interpretation for each ISO/IEC 25010 characteristic in Table 13, followed by a discussion of the '
  'comments of the respondents.]', italic=True)
table(['Quality characteristic', 'Visually impaired users (mean)', 'IT experts (mean)', 'Interpretation'], [
    ['Functional suitability', '', '', ''],
    ['Performance efficiency', '', '', ''],
    ['Usability', '', '', ''],
    ['Reliability', '', '', ''],
    ['Security', '', '', ''],
    ['Overall', '', '', ''],
], [2.0, 1.4, 1.2, 1.4], title='Summary of the ISO/IEC 25010 evaluation (to be filled in)')

h2('Discussion')
p('The results answer the problems of the study as follows. Hazards relevant to Philippine streets, '
  'including tricycles, jeepneys, stairs, potholes, poles, and open drainage, can be detected by a phone '
  'camera with an on-device model (Problems 1 and 2), with good accuracy for vehicles and people and '
  'moderate accuracy for stairs and potholes. The model runs offline on a mid-range phone at about three '
  'analyses per second (Problem 5), which is sufficient for walking pace. Short, named, prioritized warnings '
  'with vibration, confirmed across frames and limited to objects in the walking path, communicate hazards '
  'without constant speech (Problem 3). The text reader, navigation, voice commands, and SIM-based SOS '
  'complete the application and are fully operable by voice and screen reader (Problem 4).')
p('The field tests showed the value of testing on real devices: a covered camera produced a confident-'
  'sounding false alarm, which would teach a blind user to ignore real warnings, and it was corrected by '
  'treating a dark view as "cannot see" rather than as a scene to analyze. The main limitations are the '
  'model\'s weakness on furniture, barriers, and open drainage due to limited training data, the '
  'uncalibrated distance estimate, dependence on lighting, and the smart cane not yet being built.')

# ── CHAPTER V ────────────────────────────────────────────────────────────────
page_break()
h1('CHAPTER V', 'SUMMARY, CONCLUSIONS, AND RECOMMENDATIONS')

h2('Summary of Findings')
numbered([
    'A merged dataset of 25,327 images with 25 classes was prepared from nine public datasets of Philippine '
    'vehicles, potholes, open drainage, stairs, and sidewalk obstacles, plus 5,000 pseudo-labeled COCO images.',
    'A YOLO11n model was fine-tuned and deployed on Android phones as a TensorFlow Lite model that runs '
    f'without internet. On the test set, the installed model (v1) reached an mAP50 of {pct(v1["mAP50"])}, and '
    f'the retrained model (v2) reached {pct(v2["mAP50"])} with a recall of {pct(v2["recall"])}.',
    'The model performs best on tricycles, buses, jeepneys, people, cars, and carts (mAP50 0.80 to 0.93), '
    'moderately on stairs, poles, and potholes (0.52 to 0.74), and poorly on furniture, barriers, open '
    'drainage, and rare classes.',
    'On a mid-range phone, the application analyzed 2.5 to 3.0 frames per second with 135 to 215 ms of model '
    'time per frame.',
    'The warning system confirms detections over frames, ignores views the camera cannot see, names stairs, '
    'vehicles, people, and animals, calls other objects "obstacle", and orders warnings by danger.',
    'The text reader, walking navigation, bilingual voice commands, optional online assistant and object '
    'naming, Teach My AI, and SIM-based emergency SOS were implemented; all 236 automated tests passed.',
    'Field tests found and led to the correction of a false open-drain alarm when the camera was covered and '
    'of outdated AI boxes after the camera moved.',
    'User acceptance results: [to be summarized after the evaluation].',
])

h2('Conclusions')
p('Based on the findings, the following conclusions are drawn:')
numbered([
    'An ordinary mid-range Android phone can detect common street hazards and vehicles in real time without '
    'an internet connection, making an affordable assistive aid feasible for visually impaired pedestrians '
    'in the Philippines.',
    'Training on local data matters: the model recognizes tricycles and jeepneys well because they were in '
    'the training data, while classes without local or labeled data remain weak.',
    'How warnings are delivered is as important as detection accuracy: confirmation across frames, a '
    '"cannot see" state, walking-path filtering, and short prioritized messages are necessary to avoid '
    'false or overwhelming alerts.',
    'Keeping safety functions offline and using online AI only as an optional extra gives the benefits of '
    'both without making safety depend on the network.',
    'Testing with real phones in real conditions is essential, because some serious problems appear only there.',
    '[Conclusion on user acceptance, after the evaluation.]',
])

h2('Recommendations')
numbered([
    'Collect and hand-label photos of Dumaguete sidewalks, especially open drainage, barriers, curbs, stairs '
    '(going up and down), and furniture, using the Teach My AI feature, and retrain the model.',
    'Complete the training of model v2 (or a successor), evaluate it against v1 on the same test set, and '
    'install it in the application if it is better.',
    'Build the ESP32 smart cane according to the defined protocol to add ground-level drop and chest-height '
    'detection that a camera cannot provide.',
    'Calibrate the distance estimate outdoors with measured distances, or use phones with depth sensors, '
    'before ever speaking distances in meters.',
    'Conduct longer field trials with visually impaired users together with orientation and mobility '
    'instructors, in different lighting and weather conditions.',
    'Convert the model to an 8-bit quantized version to increase speed and reduce battery use, and test on '
    'lower-end phones.',
    'Add more regional languages for voice commands and replies, such as Hiligaynon and Ilocano.',
])

# ── REFERENCES ───────────────────────────────────────────────────────────────
page_break()
front_heading('REFERENCES')
refs = [
    'Bewley, A., Ge, Z., Ott, L., Ramos, F., & Upcroft, B. (2016). Simple online and realtime tracking. In '
    '2016 IEEE International Conference on Image Processing (ICIP) (pp. 3464-3468). IEEE.',
    'Bourne, R. R. A., Flaxman, S. R., Braithwaite, T., Cicinelli, M. V., Das, A., Jonas, J. B., et al. '
    '(2017). Magnitude, temporal trends, and projections of the global prevalence of blindness and distance '
    'and near vision impairment: A systematic review and meta-analysis. The Lancet Global Health, 5(9), e888-e897.',
    'Dakopoulos, D., & Bourbakis, N. G. (2010). Wearable obstacle avoidance electronic travel aids for blind: '
    'A survey. IEEE Transactions on Systems, Man, and Cybernetics, Part C (Applications and Reviews), 40(1), 25-35.',
    'Google. (n.d.). Text recognition v2. ML Kit. https://developers.google.com/ml-kit/vision/text-recognition/v2',
    'Google AI for Developers. (n.d.). Image understanding: Object detection. Gemini API documentation. '
    'https://ai.google.dev/gemini-api/docs/image-understanding',
    'Howard, A. G., Zhu, M., Chen, B., Kalenichenko, D., Wang, W., Weyand, T., Andreetto, M., & Adam, H. '
    '(2017). MobileNets: Efficient convolutional neural networks for mobile vision applications. arXiv:1704.04861.',
    'ISO/IEC. (2011). ISO/IEC 25010:2011 Systems and software engineering - Systems and software Quality '
    'Requirements and Evaluation (SQuaRE) - System and software quality models. International Organization '
    'for Standardization.',
    'Jocher, G., & Qiu, J. (2024). Ultralytics YOLO11 (Version 11.0.0) [Computer software]. '
    'https://github.com/ultralytics/ultralytics',
    'Khanam, R., & Hussain, M. (2024). YOLOv11: An overview of the key architectural enhancements. arXiv:2410.17725.',
    'Kuriakose, B., Shrestha, R., & Sandnes, F. E. (2022). Tools and technologies for blind and visually '
    'impaired navigation support: A review. IETE Technical Review, 39(1), 3-18.',
    'Lin, T.-Y., Maire, M., Belongie, S., Hays, J., Perona, P., Ramanan, D., Dollár, P., & Zitnick, C. L. '
    '(2014). Microsoft COCO: Common objects in context. In European Conference on Computer Vision (ECCV) '
    '(pp. 740-755). Springer.',
    'Liu, W., Anguelov, D., Erhan, D., Szegedy, C., Reed, S., Fu, C.-Y., & Berg, A. C. (2016). SSD: Single '
    'shot multibox detector. In European Conference on Computer Vision (ECCV) (pp. 21-37). Springer.',
    'Luxen, D., & Vetter, C. (2011). Real-time routing with OpenStreetMap data. In Proceedings of the 19th ACM '
    'SIGSPATIAL International Conference on Advances in Geographic Information Systems (pp. 513-516). ACM.',
    'Real, S., & Araujo, A. (2019). Navigation systems for the blind and visually impaired: Past work, '
    'challenges, and open problems. Sensors, 19(15), 3404.',
    'Redmon, J., Divvala, S., Girshick, R., & Farhadi, A. (2016). You only look once: Unified, real-time '
    'object detection. In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition '
    '(CVPR) (pp. 779-788).',
    'Republic Act No. 7277. (1992). Magna Carta for Disabled Persons. Republic of the Philippines.',
    'Republic Act No. 9442. (2007). An Act Amending Republic Act No. 7277. Republic of the Philippines.',
    'Republic Act No. 10173. (2012). Data Privacy Act of 2012. Republic of the Philippines.',
    'World Health Organization. (2019). World report on vision. World Health Organization.',
    'World Wide Web Consortium. (2018). Web Content Accessibility Guidelines (WCAG) 2.1. https://www.w3.org/TR/WCAG21/',
    'Zhang, Y., Sun, P., Jiang, Y., Yu, D., Weng, F., Yuan, Z., Luo, P., Liu, W., & Wang, X. (2022). ByteTrack: '
    'Multi-object tracking by associating every detection box. In European Conference on Computer Vision '
    '(ECCV) (pp. 1-21). Springer.',
    '[Add the local studies reviewed in Chapter II and the dataset sources in Appendix F.]',
]
for ref in refs:
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Inches(0.5)
    para.paragraph_format.first_line_indent = Inches(-0.5)
    para.paragraph_format.line_spacing = 1.15
    para.paragraph_format.space_after = Pt(8)
    para.add_run(ref)

# ── APPENDICES ───────────────────────────────────────────────────────────────
page_break()
front_heading('APPENDIX A: EVALUATION QUESTIONNAIRE (ISO/IEC 25010)')
p('Instructions: Please rate each statement about GuideAI. 5 - Strongly Agree, 4 - Agree, 3 - Neutral, '
  '2 - Disagree, 1 - Strongly Disagree. For visually impaired respondents, the facilitator reads each '
  'statement aloud and records the answer.', indent=False)
q = {
    'Functional suitability': [
        'The application warns me about obstacles and vehicles in front of me.',
        'The warnings tell me the direction of the obstacle (left, ahead, right).',
        'The text reader reads printed text correctly.',
        'Walking navigation guides me to my destination.',
        'The emergency SOS sends my location to my contacts.',
    ],
    'Performance efficiency': [
        'Warnings come quickly enough while I walk.',
        'The application works without an internet connection.',
        'The application does not drain the battery too quickly.',
    ],
    'Usability': [
        'I can use the application without seeing the screen.',
        'The spoken warnings are short and easy to understand.',
        'The buttons are easy to find with TalkBack or by touch.',
        'The voice commands understand what I say.',
        'I could learn to use the application quickly.',
    ],
    'Reliability': [
        'The application does not crash or freeze.',
        'The application rarely gives false warnings.',
        'The application tells me when the camera cannot see.',
    ],
    'Security': [
        'I am comfortable that my contacts and name stay on my phone.',
        'The application tells me when a picture is sent online.',
    ],
}
for char, items in q.items():
    table(['', char, '5', '4', '3', '2', '1'],
          [[str(i + 1), s, '', '', '', '', ''] for i, s in enumerate(items)],
          [0.3, 3.95, 0.35, 0.35, 0.35, 0.35, 0.35], size=9)
p('Comments and suggestions: ______________________________________________', indent=False)

page_break()
front_heading('APPENDIX B: VOICE COMMANDS')
table(['Action', 'English (offline)', 'Tagalog (offline)'], [
    ['Navigate', '"Navigate to the public market", "Take me to Silliman Medical"', '"Pumunta sa palengke", "Dalhin mo ako sa ospital"'],
    ['Where am I', '"Where am I?", "What street is this?"', '"Nasaan ako?"'],
    ['Read text', '"Read text", "What does this say?"', '"Basahin mo ito"'],
    ['Detect obstacles', '"Detect obstacles", "What is around me?"', '"Ano ang nasa harap ko?"'],
    ['Describe scene (online)', '"What is in front of me?", "Describe this"', '(online assistant)'],
    ['Emergency', '"Emergency", "Help", "Send SOS"', '"Tulong", "Saklolo"'],
    ['Controls', '"Stop", "Repeat", "Mute", "Settings"', '"Tigil", "Ulitin"'],
], [1.4, 2.4, 2.2], title='Voice command examples', size=9)
p('When the phone is online, free-form requests in English, Tagalog, or Cebuano (for example "Asa ko?", '
  '"Tabang") are understood by the '
  'online assistant; emergency and stop commands are always handled offline.', indent=False, italic=True, size=10)

page_break()
front_heading('APPENDIX C: SMART CANE BLUETOOTH PROTOCOL (SUMMARY)')
p('The ESP32 cane is a Bluetooth Low Energy peripheral advertising as "GuideAI-Cane". The full specification '
  'is in hardware/PROTOCOL.md of the project.', indent=False)
table(['Characteristic', 'UUID', 'Property', 'Content'], [
    ['Sensor readings', '6e7a0002-4f1b-4c1d-9b3a-2a6e8c9d0b00', 'Notify, ~10 Hz', '4 bytes: frontCm (uint16), groundCm (uint16), little-endian; 0xFFFF = no reading'],
    ['Events', '6e7a0003-4f1b-4c1d-9b3a-2a6e8c9d0b00', 'Notify', '0x01 SOS held 2 s; 0x02 mode short press (Where am I); 0x03 mode long press (voice); 0x04 fall detected'],
    ['Commands', '6e7a0004-4f1b-4c1d-9b3a-2a6e8c9d0b00', 'Write', '0x01 + pattern: vibrate; 0x02 + duration: buzzer'],
    ['Battery level', '0x2A19 (service 0x180F)', 'Read, Notify', '0-100 %'],
], [1.1, 2.1, 0.9, 1.9], title='Cane service 6e7a0001-4f1b-4c1d-9b3a-2a6e8c9d0b00', size=8.5)
table(['Rule', 'Value'], [
    ['Front obstacle: warning / stop', '≤ 150 cm / ≤ 70 cm'],
    ['Normal ground distance (start value, then learned)', '80 cm'],
    ['Drop (stairs down, canal, hole)', 'ground ≥ 25 cm farther than normal, 2 readings in a row'],
    ['Step or curb', 'ground ≥ 20 cm closer than normal'],
], [3.0, 3.0], title='Cane hazard thresholds (shared by the firmware and the application)')

page_break()
front_heading('APPENDIX D: USER MANUAL')
h3('Installing')
numbered([
    'Install the GuideAI APK on an Android phone (allow installation from this source when asked).',
    'Open GuideAI and allow access to the camera, microphone, location, and SMS when asked.',
    'Enter your name and add at least one emergency contact (Settings > Emergency Contacts).',
])
h3('Detecting Obstacles')
numbered([
    'Open the Detect tab, or say "Detect obstacles". Detection starts automatically.',
    'Hold or wear the phone at chest height with the back camera facing forward.',
    'Listen for warnings such as "Careful, stairs ahead." Tap anywhere on the screen to pause or resume.',
    'Tap "Describe What\'s Ahead" to hear everything the camera currently sees.',
    'If you hear "Camera view is too dark or covered," uncover the camera or find more light.',
])
h3('Reading Text, Navigating, and Getting Help')
bullets([
    'Read tab: point the camera at the text about 30 cm away and tap Read Text.',
    'Navigate tab: choose a place or tap "Say Where To Go", then follow the spoken directions.',
    '"Where Am I?": hear your current street and area.',
    'Emergency SOS: press the red button; after the 5-second countdown, your location is texted to your '
    'contacts. Tap again during the countdown to cancel.',
])
h3('Settings')
bullets([
    'Speech speed, voice accent, and vibration strength.',
    'Detection source: phone camera, cane, or both.',
    'AI object names (online) on or off; Teach My AI for collecting training pictures.',
    'Check for Updates downloads the newest version of the application.',
])

page_break()
front_heading('APPENDIX E: DETECTION CLASSES AND SPOKEN WORDS')
cls_rows = [
    ['person', 'Person', 'Careful, person ...'], ['bicycle', 'Bicycle', 'Careful, bicycle ...'],
    ['car', 'Car', 'Careful, car ...'], ['motorcycle', 'Motorcycle', 'Careful, motorcycle ...'],
    ['tricycle', 'Tricycle', 'Careful, tricycle ...'], ['jeepney', 'Jeepney', 'Careful, jeepney ...'],
    ['bus', 'Bus', 'Careful, bus ...'], ['truck', 'Truck', 'Careful, truck ...'],
    ['dog', 'Dog', 'Careful, dog ...'], ['cat', 'Cat', 'Careful, cat ...'],
    ['cow', 'Large animal', 'Careful, cow ...'], ['horse', 'Horse', 'Careful, horse ...'],
    ['pothole', 'Pothole', 'Careful, obstacle ...'], ['open_drainage', 'Open drain', 'Careful, obstacle ...'],
    ['stairs', 'Stairs', 'Careful, stairs ...'], ['pole', 'Pole', 'Careful, obstacle ...'],
    ['barrier', 'Barrier', 'Careful, obstacle ...'], ['bump', 'Bump', 'Careful, obstacle ...'],
    ['cart', 'Cart', 'Careful, obstacle ...'], ['bench', 'Bench', 'Careful, obstacle ...'],
    ['chair', 'Chair', 'Careful, obstacle ...'], ['fire hydrant', 'Fire hydrant', 'Careful, obstacle ...'],
    ['potted plant', 'Plant pot', 'Careful, obstacle ...'], ['traffic light', 'Traffic light', 'Careful, obstacle ...'],
    ['stop sign', 'Stop sign', 'Careful, obstacle ...'],
]
table(['Model class', 'Shown on screen', 'Spoken (+ ahead / on your left / on your right)'], cls_rows,
      [1.6, 1.6, 2.8], title='The 25 detection classes', size=9)

page_break()
front_heading('APPENDIX F: DATASET SOURCES')
p('[For each public dataset in Table 4, give its full title, author or organization, download URL (for '
  'example the Roboflow Universe or Kaggle page), license, and the date it was downloaded. COCO 2017: '
  'Lin et al. (2014), https://cocodataset.org, Creative Commons Attribution 4.0 for annotations.]',
  italic=True, indent=False)

page_break()
front_heading('APPENDIX G: SYSTEM USE CASES AND DATA MODEL')
p('The use-case diagram shows the functions each actor can perform. The blind pedestrian is '
  'the primary user. Family members or helpers receive emergency messages and can mark an SOS as resolved. '
  'Google Gemini and OpenStreetMap are online services used only for optional features. The smart cane is '
  'shown as planned, because its protocol is defined but its hardware was not built in this study. The table below describes the main use cases.')
figure('fig_usecase.png', 'Use-case diagram of GuideAI', width=6.0)
table(['Use case', 'Actor', 'Main flow'], [
    ['UC1 Detect obstacles and hear warnings', 'Pedestrian', 'Camera analyzes frames; confirmed hazards are spoken and vibrate'],
    ['UC2 Describe what\'s ahead', 'Pedestrian', 'All current warnings are spoken in priority order'],
    ['UC3 Read printed text', 'Pedestrian', 'Camera captures text; on-device OCR reads it aloud'],
    ['UC4 Navigate to a place', 'Pedestrian', 'Destination found, route computed, spoken turn-by-turn steps'],
    ['UC5 Where am I?', 'Pedestrian', 'GPS and reverse geocoding speak the street and area'],
    ['UC6 Give a voice command', 'Pedestrian', 'Speech is matched to an action; online assistant if available'],
    ['UC7 Send emergency SOS', 'Pedestrian', '5-second countdown (cancellable), then SMS with location to contacts'],
    ['UC8 Mark SOS as resolved', 'Helper / contact', 'SOS event status set to resolved'],
    ['UC9 Manage emergency contacts', 'Pedestrian', 'Add, edit or remove contacts stored on the phone'],
    ['UC10 Change settings', 'Pedestrian', 'Speech, vibration, detection source and AI options saved at once'],
    ['UC11 Name objects with AI', 'Pedestrian (online)', 'Camera picture sent to Gemini; names shown on screen'],
    ['UC12 Save pictures for training', 'Pedestrian, then developer', 'Unsure or taught pictures saved; labelled on the PC'],
], [2.2, 1.3, 3.0], title='Description of the main use cases', size=8.5)

h3('Entity-Relationship Diagram')
p('The entity-relationship diagram shows the data the system keeps. GuideAI has no user accounts, so the data belongs to the phone, '
  'identified by a random device identifier created at first launch. Settings and emergency contacts are '
  'stored on the phone. Only the SOS event is also stored on the server, linked to the phone by its device '
  'identifier. Navigation routes, text-reader history, and camera frames are not stored.')
figure('fig_erd.png', 'Entity-relationship diagram of GuideAI', width=6.0)

page_break()
front_heading('APPENDIX H: CURRICULUM VITAE')
for i in range(1, 4):
    p(f'[Proponent {i}: photo, full name, address, contact number, e-mail, educational background, skills, '
      'and seminars attended]', italic=True, indent=False, space_after=24)

doc.save(OUT)
print('Saved', OUT)
