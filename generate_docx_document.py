from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_document():
    doc = Document()
    
    # ── Page Setup: 1 inch margins ──
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.different_first_page_header_footer = True
        
        # Configure Header and Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("GuideAI (BUTA APP) — System Architecture & Operational Guide")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(156, 163, 175)
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        frun1 = fp.add_run("Confidential & Proprietary • GuideAI Research & Engineering")
        frun1.font.name = "Calibri"
        frun1.font.size = Pt(8.5)
        frun1.font.color.rgb = RGBColor(156, 163, 175)

    # Helper styling functions
    def set_cell_background(cell, fill_hex):
        tcPr = cell._element.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
        tcPr = cell._element.get_or_add_tcPr()
        tcMar = parse_xml(f'''
            <w:tcMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tcMar>
        ''')
        tcPr.append(tcMar)

    def set_table_borders(table, color="D1D5DB", sz="4"):
        tblPr = table._element.xpath('w:tblPr')
        if tblPr:
            borders = parse_xml(f'''
                <w:tblBorders {nsdecls("w")}>
                    <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:left w:val="none"/>
                    <w:right w:val="none"/>
                    <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
                    <w:insideV w:val="none"/>
                </w:tblBorders>
            ''')
            tblPr[0].append(borders)

    def add_callout(text, title="SYSTEM DESIGN PRINCIPLE", color_hex="1A365D", bg_hex="F8FAFC"):
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        cell = table.cell(0, 0)
        cell.width = Inches(6.5)
        set_cell_background(cell, bg_hex)
        set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
        
        tcPr = cell._element.get_or_add_tcPr()
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:left w:val="single" w:sz="24" w:space="0" w:color="{color_hex}"/>
                <w:bottom w:val="none"/>
                <w:right w:val="none"/>
            </w:tcBorders>
        ''')
        tcPr.append(borders)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        
        r_title = p.add_run(f"[{title}] ")
        r_title.bold = True
        r_title.font.name = "Calibri"
        r_title.font.size = Pt(10)
        r_title.font.color.rgb = RGBColor(26, 54, 93) if color_hex == "1A365D" else RGBColor(185, 28, 28)
        
        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = RGBColor(55, 65, 81)
        
        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    def add_heading_1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(26, 54, 93) # Deep Navy
        return p

    def add_heading_2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(13, 148, 136) # Teal
        return p

    def add_heading_3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(31, 41, 55) # Dark Charcoal
        return p

    def add_p(text, bold_prefix=None, space_after=4):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.bold = True
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(10.5)
            r_bold.font.color.rgb = RGBColor(17, 24, 39)
        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10.5)
        r_text.font.color.rgb = RGBColor(55, 65, 81)
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.bold = True
            r_bold.font.name = "Calibri"
            r_bold.font.size = Pt(10.5)
            r_bold.font.color.rgb = RGBColor(17, 24, 39)
        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10.5)
        r_text.font.color.rgb = RGBColor(55, 65, 81)
        return p

    # ═══════════════════════════════════════════════════════════════
    # COVER / HEADER TITLE BLOCK
    # ═══════════════════════════════════════════════════════════════
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(24)
    title_p.paragraph_format.space_after = Pt(4)
    r_title = title_p.add_run("GuideAI (BUTA APP)")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(26)
    r_title.font.color.rgb = RGBColor(26, 54, 93)

    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_before = Pt(0)
    subtitle_p.paragraph_format.space_after = Pt(16)
    r_sub = subtitle_p.add_run("Real-Time Visual Assistance, Smart Cane Integration & Autonomous Navigation System")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(14)
    r_sub.font.color.rgb = RGBColor(13, 148, 136)

    # Document Meta Table
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    set_table_borders(meta_table, "E5E7EB", "4")
    
    meta_data = [
        ("Document Classification:", "Complete Engineering Specification & Operational Reference"),
        ("Target Platform & Framework:", "React Native / Expo v52 (Android Primary) • ESP32 Smart Cane • Express Backend"),
        ("Target End-Users:", "Visually Impaired and Blind Pedestrians (Philippine Urban & Rural Context)"),
        ("Core Operating Philosophy:", "100% Blind-First, Offline-First, Accountless, Non-Visual Multimodal Feedback"),
    ]
    for i, (k, v) in enumerate(meta_data):
        cell_k = meta_table.cell(i, 0)
        cell_v = meta_table.cell(i, 1)
        cell_k.width = Inches(2.2)
        cell_v.width = Inches(4.3)
        set_cell_background(cell_k, "F8FAFC")
        set_cell_background(cell_v, "FFFFFF")
        set_cell_margins(cell_k, 60, 60, 100, 100)
        set_cell_margins(cell_v, 60, 60, 100, 100)
        
        pk = cell_k.paragraphs[0]
        pk.paragraph_format.space_before = Pt(0)
        pk.paragraph_format.space_after = Pt(0)
        rk = pk.add_run(k)
        rk.bold = True
        rk.font.name = "Calibri"
        rk.font.size = Pt(9.5)
        rk.font.color.rgb = RGBColor(31, 41, 55)
        
        pv = cell_v.paragraphs[0]
        pv.paragraph_format.space_before = Pt(0)
        pv.paragraph_format.space_after = Pt(0)
        rv = pv.add_run(v)
        rv.font.name = "Calibri"
        rv.font.size = Pt(9.5)
        rv.font.color.rgb = RGBColor(75, 85, 99)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ═══════════════════════════════════════════════════════════════
    # SECTION 1: EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("1. Executive Summary")
    add_p(
        "GuideAI (internally designated as BUTA APP, from the Visayan and Tagalog word for 'blind') is an AI-powered, "
        "multimodal assistive mobility ecosystem engineered specifically for blind and visually impaired pedestrians. "
        "While conventional navigation and mobility tools assume sighted users operating visual map screens with consistent high-speed internet, "
        "GuideAI is designed from the ground up under a strict 'Blind-First' and 'Offline-First' engineering paradigm."
    )
    add_p(
        "The system unites three complementary elements into a unified safety shield: an on-device smartphone application "
        "powered by fine-tuned edge computer vision (YOLOv11n), an Internet of Things (IoT) ultrasonic and laser-equipped smart white cane "
        "driven by an ESP32 microcontroller, and an optional auxiliary cloud microservice. GuideAI addresses the acute, everyday hazards "
        "of navigating Philippine sidewalks and urban streets—including irregular sidewalk surfaces, open drainage canals, low-hanging wires, "
        "construction barricades, vendor carts, and distinctive regional vehicles such as tricycles and jeepneys."
    )
    
    add_callout(
        "GuideAI operates without requiring user accounts, passwords, or mandatory internet connectivity. "
        "All critical perception, local landmark routing, sign reading, and emergency SMS functions run directly on the physical mobile hardware "
        "and cane sensors, guaranteeing life-safety assistance even in zero-data rural environments or network outages.",
        title="CORE DESIGN PHILOSOPHY",
        color_hex="1A365D",
        bg_hex="F0FDF4"
    )

    # ═══════════════════════════════════════════════════════════════
    # SECTION 2: PHILIPPINE PEDESTRIAN CONTEXT & SOCIO-TECHNICAL CHALLENGES
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("2. Philippine Pedestrian Context & The Blind Reality")
    add_p(
        "Pedestrian environments in Philippine cities (such as Metro Manila, Cebu, and regional university cities like Dumaguete) "
        "present unique, compounding mobility barriers that standard Western-developed assistive tools fail to address:"
    )
    
    add_bullet(
        "Sidewalks frequently have uncovered manholes, exposed roadside drainage canals (gutters), sudden curb elevation drops, "
        "or missing pavers that pose severe fall risks.",
        bold_prefix="Infrastructure Irregularities: "
    )
    add_bullet(
        "Roadways and sidewalks are densely populated by tricycles, motorized pedicabs, jeepneys, and motorcycles that do not adhere to fixed lane geometry "
        "and frequently mount sidewalk aprons.",
        bold_prefix="Regional Vehicle Ecologies: "
    )
    add_bullet(
        "Utility poles planted in the middle of pedestrian footpaths, low-hanging telecommunication cables, awnings, and sidewalk vendor stalls "
        "create head- and chest-height hazards that traditional white canes pass underneath without detecting.",
        bold_prefix="Overhead & Chest-Height Obstacles: "
    )
    add_bullet(
        "Mobile data coverage can be intermittent, prepaid SIM cards may run out of data credits unexpectedly, and latency to international cloud AI servers "
        "can exceed 2 to 5 seconds—unacceptable when a blind pedestrian is stepping toward a street or hole.",
        bold_prefix="Data Scarcity & Network Latency: "
    )

    # ═══════════════════════════════════════════════════════════════
    # SECTION 3: SYSTEM ARCHITECTURE & THREE-TIER ECOSYSTEM
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("3. System Architecture & Three-Tier Ecosystem")
    add_p(
        "GuideAI employs a resilient, three-tier architecture that distributes computational workloads according to safety urgency, "
        "battery endurance, and environmental connectivity:"
    )

    # Architectural Overview Table
    arch_table = doc.add_table(rows=4, cols=3)
    arch_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    arch_table.autofit = False
    set_table_borders(arch_table, "D1D5DB", "4")
    
    headers = ["System Tier", "Primary Hardware / Tech Stack", "Functional Responsibilities"]
    for j, h in enumerate(headers):
        cell = arch_table.cell(0, j)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    arch_rows = [
        ("Tier 1: Mobile Client\n(Primary Orchestrator)",
         "React Native / Expo v52\nTypeScript, Zustand\nfast-tflite, Google ML Kit\nNative DirectSms Android Module",
         "• On-device YOLOv11n computer vision inference (320px)\n• Multi-frame object tracking and trajectory prediction\n• Free OpenStreetMap / OSRM pedestrian turn-by-turn guidance\n• Priority queue Text-to-Speech (TTS) and tactile haptics\n• Direct-from-SIM cellular SMS emergency dispatch\n• Tagalog & English speech recognition and intent router"),
        ("Tier 2: IoT Smart Cane\n(Sensory Companion)",
         "ESP32 Microcontroller\nRCWL-1601 Ultrasonic Sensor\nVL53L0X Laser ToF Sensor\nMPU6050 6-Axis IMU Sensor\nBLE Peripheral (GATT)",
         "• Autonomous tactile and audible warning (vibrator + buzzer)\n• Chest-height obstacle detection (up to 150 cm)\n• Adaptive ground baseline learning (drop and step detection)\n• High-G fall impact detection\n• 10Hz BLE telemetry stream to Tier 1 mobile client\n• Physical hardware SOS and mode toggles"),
        ("Tier 3: Cloud Microservice\n(Auxiliary Backup)",
         "Node.js / Express\nTypeScript, Zod, Helmet\nTwilio SMS API Client\nGoogle Maps & Cloud Vision\nSupabase Service Role",
         "• Secondary emergency SMS dispatch via Twilio (backup)\n• Cloud Vision OCR fallback for complex typography\n• Geocoding and Directions proxy when device GPS requests\n• Immutable audit logging for emergency events\n• Zero user credentials or identity storage (accountless)"),
    ]

    col_widths = [Inches(1.8), Inches(2.2), Inches(2.5)]
    for i, row in enumerate(arch_rows):
        for j, val in enumerate(row):
            cell = arch_table.cell(i+1, j)
            cell.width = col_widths[j]
            bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 80, 80, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.name = "Calibri"
            r.font.size = Pt(9.0)
            r.font.color.rgb = RGBColor(31, 41, 55)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ═══════════════════════════════════════════════════════════════
    # SECTION 4: THE FIVE CORE FUNCTIONAL PILLARS
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("4. Core Functional Pillars: Deep-Dive Analysis")

    # ── PILLAR 1: HAZARD DETECTION ──
    add_heading_2("4.1 Pillar 1: Real-Time Hazard & Obstacle Perception")
    add_p(
        "Hazard detection is GuideAI's primary safety shield. It transforms raw visual and sensor telemetry into concise, "
        "actionable spoken and haptic alerts without overwhelming the pedestrian's auditory senses."
    )
    
    add_heading_3("Dual-Source Sensing Architecture")
    add_p(
        "GuideAI allows the user to select their active detection input source via application settings: "
        "(1) Phone Camera Only, (2) Cane Device Only, or (3) Both Sources simultaneously. "
        "When both sources are active, their data streams feed into a unified arbitration engine (the Hazard Announcer), "
        "ensuring the user receives a single coherent stream of voice and vibration feedback."
    )

    add_heading_3("On-Device YOLOv11 Computer Vision Pipeline")
    add_p(
        "The mobile camera executes a lightweight, fine-tuned YOLOv11 nano (320x320 float32) model directly on the device using "
        "react-native-fast-tflite. Unlike cloud-based vision APIs that require internet uploads and introduce multi-second lag, "
        "on-device inference achieves real-time speeds (~30-60 ms per frame), ensuring immediate hazard detection."
    )
    add_p(
        "The model is custom-trained on Philippine pedestrian imagery across 25 specific hazard classes categorized into three risk tiers:"
    )
    add_bullet("Potholes, open manholes/drainage canals, stairs, vehicles (cars, buses, trucks), motorcycles, jeepneys, tricycles, and construction barriers.", bold_prefix="Critical Hazards (Immediate Danger): ")
    add_bullet("Sidewalk utility poles, barriers, vendor carts/stalls, speed bumps, bicycles, low-hanging obstacles, benches, and chairs.", bold_prefix="Warning Hazards (Caution Required): ")
    add_bullet("Pedestrians, street animals (dogs, cats), traffic lights, and stop signs.", bold_prefix="Informational Objects (Contextual Awareness): ")

    add_heading_3("Multi-Frame Object Tracking Algorithm (HazardTracker)")
    add_p(
        "Raw single-frame neural network detections often flicker or generate transient false positives. GuideAI implements a custom, "
        "pure-TypeScript multi-frame tracking engine (HazardTracker) that matches objects across consecutive frames (~300 ms intervals):"
    )
    add_bullet(
        "An object must be verified in at least 2 of the last 3 camera frames before it is announced. "
        "Highly confident detections (confidence ≥ 75%) bypass this delay to report immediate dangers without hesitation.",
        bold_prefix="Temporal Confirmation: "
    )
    add_bullet(
        "Confirmed objects missed for a single frame are coasted (retained in memory), preventing alert drop-outs caused by brief motion blur.",
        bold_prefix="Flicker Suppression: "
    )
    add_bullet(
        "The tracker monitors bounding box height changes over a rolling 1200 ms time window. If an object's box height expands by more than 15% (growth ≥ 1.15), "
        "it is classified as 'Approaching'. Moving hazards that approach the pedestrian are dynamically escalated by one danger tier (e.g., Warning → Critical).",
        bold_prefix="Approach Velocity Detection: "
    )

    add_heading_3("Spatial Mapping, Distance Estimation & Corridor Filtering")
    add_p(
        "For each confirmed object, GuideAI calculates three spatial properties:"
    )
    add_bullet(
        "The horizontal center of the bounding box is mapped to 'Left' (x < 0.33), 'Ahead' (0.33 ≤ x ≤ 0.67), or 'Right' (x > 0.67).",
        bold_prefix="Directional Bearing: "
    )
    add_bullet(
        "Estimated heuristically using known real-world physical heights (e.g., average human = 1.7 m, motorcycle = 1.1 m, car = 1.5 m) "
        "relative to camera focal length and normalized box height. Distances are spoken as clean, rounded phrases (e.g., '1.5 meters', 'less than 1 meter').",
        bold_prefix="Distance Calculation: "
    )
    add_bullet(
        "The engine establishes a virtual walking corridor directly in front of the pedestrian. Objects situated outside the path that do not approach "
        "are flagged as 'Quiet'—they are displayed on the visual HUD for residual-vision users but suppressed from spoken TTS to avoid auditory clutter.",
        bold_prefix="Walking Path Relevance: "
    )

    add_heading_3("Announcement Suppression & Throttle Engine")
    add_p(
        "To prevent repetitive speech loops, the detection engine enforces a 5-second suppression throttle. "
        "A hazard with the same label in the same direction will not be repeated within 5 seconds unless: "
        "(1) its risk level escalates, or (2) it transitions to an 'Approaching' state. Furthermore, a strict maximum of two announcements "
        "per processing frame is enforced, ranked strictly by danger score."
    )

    # ── PILLAR 2: TURN-BY-TURN NAVIGATION ──
    add_heading_2("4.2 Pillar 2: Turn-by-Turn Pedestrian Walking Navigation")
    add_p(
        "GuideAI delivers accurate, autonomous pedestrian navigation without relying on proprietary, paid navigation servers or complex logins. "
        "The mobile application interfaces directly with open-standard geographic services:"
    )
    
    add_bullet(
        "When the user speaks or types a destination (e.g., 'Dumaguete Public Market' or 'Silliman Medical'), the app first checks an instant, "
        "on-device POI dictionary. If not found, it queries Komoot Photon (an ultra-fast OpenStreetMap geocoder biased toward the user's GPS coordinates), "
        "with fallback to OpenStreetMap Nominatim. Crucially, the app never invents an imaginary destination if geocoding fails.",
        bold_prefix="Multi-Tier Destination Geocoding: "
    )
    add_bullet(
        "The app constructs a walking route using public OpenStreetMap OSRM pedestrian endpoints (routed-foot), with automatic fallback to bicycle and driving graphs. "
        "It downloads polyline coordinates and step-by-step maneuvers.",
        bold_prefix="OSRM Pedestrian Routing Engine: "
    )
    add_bullet(
        "The application continuously tracks GPS location, speaks live step instructions (e.g., 'Head forward onto Real Street'), "
        "issues an audio heads-up warning 30 meters before every turn, and speaks the exact turn direction (left, right, slight-right, U-turn) "
        "when within 15 meters of the intersection.",
        bold_prefix="Active Pedestrian Guidance: "
    )
    add_bullet(
        "If the pedestrian diverges from the calculated route polyline by more than 25 meters, the engine automatically detects route departure, "
        "announces 'Off route. Recalculating directions,' and computes a fresh route from the current coordinates.",
        bold_prefix="Automatic Off-Route Rerouting: "
    )
    add_bullet(
        "A dedicated one-tap button and voice command ('Where am I?' / 'Nasaan ako') queries the device GPS and performs reverse geocoding, "
        "speaking the user's current street name, barangay/neighborhood, and nearest landmark within seconds.",
        bold_prefix="Instant 'Where Am I?' Spatial Orientation: "
    )

    # ── PILLAR 3: OFFLINE TEXT READER ──
    add_heading_2("4.3 Pillar 3: On-Device Text Reader (Offline OCR)")
    add_p(
        "Blind pedestrians encounter printed text constantly: street signs, public transit jeepney route boards, building directories, "
        "room numbers, restroom door signs, and pharmacy packaging. Traditional cloud vision APIs require strong internet connectivity "
        "and incur recurring operational fees."
    )
    add_p(
        "GuideAI embeds Google ML Kit Text Recognition (@react-native-ml-kit/text-recognition) directly inside the mobile client binary. "
        "When the user navigates to the Text Reader tab and taps the camera viewport, the frame is analyzed entirely on the smartphone's Neural Processing Unit (NPU) / CPU."
    )
    add_bullet(
        "Works seamlessly in concrete buildings, basements, or rural areas without mobile reception.",
        bold_prefix="100% Offline Autonomy: "
    )
    add_bullet(
        "OCR results are extracted and immediately read aloud via the priority TTS engine. "
        "Multi-line text is split into punctuated natural sentences to avoid robotic run-on speech.",
        bold_prefix="Phonetic Spoken Formatting: "
    )
    add_bullet(
        "The screen maintains a local scrollable list of the user's 10 most recent scans, allowing users to replay previously recognized signs or labels.",
        bold_prefix="Local Reading History: "
    )

    # ── PILLAR 4: EMERGENCY SOS & LIFE-SAFETY NETWORK ──
    add_heading_2("4.4 Pillar 4: Emergency SOS & Dual-Channel Dispatch")
    add_p(
        "When a blind pedestrian experiences a medical crisis, disorientation, harassment, or physical accident, "
        "accessing emergency assistance must be instantaneous and fail-safe. GuideAI implements a life-safety protocol engineered for extreme conditions:"
    )

    add_heading_3("Primary Channel: Direct-from-SIM Cellular SMS (No Internet Required)")
    add_p(
        "Most commercial apps dispatch emergency notifications via internet-based HTTP webhooks or third-party cloud APIs. "
        "If the user has zero mobile data credits, is in a weak 2G signal zone, or the backend server is unreachable, cloud notifications fail completely. "
        "GuideAI bypasses this vulnerability by introducing a custom native Android module (DirectSms) written in Java/Kotlin. "
        "This module interfaces directly with the Android operating system's native SmsManager, transmitting SMS text messages directly from "
        "the physical SIM card inserted in the phone. As long as a standard cellular phone signal is present, emergency texts are guaranteed to transmit."
    )

    add_heading_3("Spoken 5-Second Countdown & Accidental Press Protection")
    add_p(
        "Tapping the full-screen Emergency SOS button initiates a 5-second spoken countdown ('Emergency SOS activating in 5, 4, 3, 2, 1...') "
        "accompanied by synchronized haptic pulses. The user can cancel the countdown at any second by tapping anywhere on the screen or pressing the cancel button, "
        "preventing accidental false alarms."
    )

    add_heading_3("SMS Payload & Encoding Optimization")
    add_p(
        "Once triggered, GuideAI captures the user's precise GPS coordinates and constructs an emergency SMS dispatch sent sequentially to every registered contact:"
    )
    add_callout(
        '"EMERGENCY: [User Name] needs help near [Street/Area]. Location: https://maps.google.com/?q=9.307200,123.308200 - sent by GuideAI, an app for the visually impaired."',
        title="OUTBOUND SOS SMS PAYLOAD",
        color_hex="B91C1C",
        bg_hex="FEF2F2"
    )
    add_p(
        "The message is deliberately composed in pure standard ASCII text without emojis. In cellular telecommunications, emojis force the SMS gateway "
        "to switch to UCS-2 encoding (limiting messages to 70 characters per segment instead of 160), which can fragment messages and incur unnecessary carrier costs. "
        "The Google Maps hyperlink allows the recipient to immediately open turn-by-turn driving or walking directions directly to the user's exact coordinates."
    )

    add_heading_3("Philippine Phone Number Normalization Engine")
    add_p(
        "Emergency contacts are verified upon entry using a strict phone number sanitizer. "
        "It validates standard Philippine mobile formats (09XXXXXXXXX [11 digits] and +639XXXXXXXXX [12 digits]) as well as international numbers (7-15 digits). "
        "To assist TalkBack screen reader users when reviewing entered numbers, GuideAI provides a phonetic digit-spelling helper "
        "(e.g., '0 9 1 7, 1 2 3, 4 5 6 7'), ensuring users can audibly verify contact accuracy."
    )

    add_heading_3("Secondary Backup Channel & 'Mark as Resolved' Workflow")
    add_p(
        "When active Wi-Fi or mobile data is present, the app concurrently transmits an SOS event payload to the Express backend server, "
        "which sends backup SMS alerts via Twilio and logs the incident in Supabase. Once the crisis is handled, tapping 'Mark as Resolved' "
        "dispatches an automated follow-up SMS notifying contacts that the user is now safe."
    )

    # ── PILLAR 5: BILINGUAL VOICE ASSISTANT ──
    add_heading_2("4.5 Pillar 5: Voice Assistant & Bilingual Natural Language Processing")
    add_p(
        "Navigating touch interfaces while holding a white cane can be challenging. GuideAI integrates a hands-free, "
        "bilingual voice assistant powered by Android's native speech recognizer (expo-speech-recognition):"
    )
    
    # Voice Command Table
    voice_table = doc.add_table(rows=7, cols=3)
    voice_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    voice_table.autofit = False
    set_table_borders(voice_table, "D1D5DB", "4")
    
    v_headers = ["Intent Type", "English Voice Commands", "Tagalog / Filipino Equivalents"]
    for j, h in enumerate(v_headers):
        cell = voice_table.cell(0, j)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    v_rows = [
        ("NAVIGATE", '"Navigate to Public Market"\n"Take me to Silliman Medical"\n"Directions to Mercury Drug"', '"Pumunta sa palengke"\n"Dalhin mo ako sa ospital"\n"Papunta sa botika"'),
        ("WHERE_AM_I", '"Where am I?"\n"What street am I on?"\n"My location"', '"Nasaan ako?"\n"Saan ako banda?"\n"Anong kalsada ito?"'),
        ("READ_TEXT", '"Read text"\n"Read sign"\n"What does this say?"', '"Basahin mo ito"\n"Ano ang nakasulat?"\n"Basahin ang karatula"'),
        ("DETECT", '"Scan environment"\n"What is around me?"\n"Detect obstacles"', '"Ano ang nasa harap ko?"\n"Ano ang nasa paligid?"\n"Tingnan ang paligid"'),
        ("SOS", '"Emergency"\n"Call for help"\n"Send SOS"', '"Tulong"\n"Saklolo"\n"Tulungan mo ako"'),
        ("STOP / CONTROL", '"Stop", "Quiet", "Repeat", "Settings"', '"Tigil", "Hinto", "Tama na", "Ulitin"'),
    ]

    v_col_widths = [Inches(1.5), Inches(2.5), Inches(2.5)]
    for i, row in enumerate(v_rows):
        for j, val in enumerate(row):
            cell = voice_table.cell(i+1, j)
            cell.width = v_col_widths[j]
            bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 80, 80, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.name = "Calibri"
            r.font.size = Pt(9.0)
            r.font.color.rgb = RGBColor(31, 41, 55)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ═══════════════════════════════════════════════════════════════
    # SECTION 5: HARDWARE COMPANION: THE ESP32 SMART CANE
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("5. Hardware Companion: The GuideAI Smart Cane (ESP32)")
    add_p(
        "A smartphone camera held by a pedestrian has natural optical limitations: it points forward and slightly downward, "
        "can be occluded by a carrying hand or pocket, and cannot easily measure sudden physical ground drops directly beneath the user's feet. "
        "To provide complete 360-degree protection, GuideAI pairs with an IoT Smart Cane companion built on the ESP32 microcontroller platform."
    )

    add_heading_3("Autonomous Fail-Safe Rule")
    add_callout(
        "The smart cane must protect the pedestrian even if the smartphone is dead, disconnected, or left at home. "
        "The ESP32 firmware drives its own on-board haptic vibration motor and piezoceramic buzzer using the exact same safety thresholds "
        "as the mobile app. The smartphone acts as an intelligence multiplier (adding voice, navigation, and SOS texting), but the cane "
        "is an autonomous life-safety instrument.",
        title="PRIMARY HARDWARE SAFETY MANDATE",
        color_hex="B91C1C",
        bg_hex="FEF2F2"
    )

    add_heading_3("Sensor Architecture & Physical Geometry")
    add_p(
        "The smart cane integrates three specialized sensors:"
    )
    add_bullet(
        "RCWL-1601 Ultrasonic Sensor mounted on the cane shaft facing forward at chest/head height. "
        "It measures obstacles between 20 cm and 400 cm ahead, detecting tree branches, truck mirrors, awnings, and signposts before they strike the user.",
        bold_prefix="Front Ultrasonic Sensor: "
    )
    add_bullet(
        "VL53L0X Time-of-Flight (ToF) Infrared Laser Sensor angled downward toward the ground 1-2 paces ahead of the physical cane tip. "
        "It measures millimeter-accurate distance to the pavement (normal baseline ~80 cm).",
        bold_prefix="Downward Laser ToF Sensor: "
    )
    add_bullet(
        "MPU6050 6-Axis Accelerometer and Gyroscope mounted inside the cane handle. "
        "It monitors cane swing angle, detects sudden ground impacts followed by stillness (fall detection), and detects if the cane is dropped.",
        bold_prefix="Inertial Measurement Unit (IMU): "
    )

    add_heading_3("Bluetooth Low Energy (BLE) GATT Protocol (v1)")
    add_p(
        "Communication between the ESP32 cane (peripheral) and the smartphone (central) is governed by a custom BLE GATT profile:"
    )
    add_bullet("Service UUID: 6e7a0001-4f1b-4c1d-9b3a-2a6e8c9d0b00 (Advertised Name: 'GuideAI-Cane').", bold_prefix="Service Identifier: ")
    add_bullet("Sensor Telemetry Characteristic (UUID ending in 0002, Notify, ~10 Hz): Transmits 4 bytes little-endian per packet: [Bytes 0-1: frontCm uint16] and [Bytes 2-3: groundCm uint16]. Value 0xFFFF signals sensor fault; ground reading 200 cm signals an empty void (drop).", bold_prefix="High-Speed Sensor Stream: ")
    add_bullet("Hardware Events Characteristic (UUID ending in 0003, Notify): 1 byte payload: 0x01 = SOS button held 2s; 0x02 = Mode button short press ('Where am I?'); 0x03 = Mode button long press (open voice assistant); 0x04 = Automated fall detected (MPU6050 trigger).", bold_prefix="Physical Buttons & Fall Notification: ")
    add_bullet("Command Characteristic (UUID ending in 0004, Write): Allows the phone to trigger cane vibrations (e.g., tactile pulses right before a street navigation turn).", bold_prefix="Bidirectional Haptic Commands: ")

    add_heading_3("Cane Hazard Detection Algorithm & Adaptive Baseline Learning")
    add_p(
        "Because blind pedestrians hold white canes at different angles and heights, static ground thresholds would produce constant false alarms. "
        "GuideAI implements an adaptive baseline learning algorithm (CaneHazardDetector):"
    )
    add_bullet("Starts at default 80 cm. For every ground reading within ±15 cm of the baseline, the baseline adapts smoothly via exponential moving average: Baseline = (Baseline * 0.9) + (Reading * 0.1).", bold_prefix="Adaptive Ground Learning: ")
    add_bullet("If ground distance exceeds baseline by ≥ 25 cm for 2 consecutive readings (e.g., reading jumps from 80 cm to 110+ cm), the system flags an open hole, descending staircase, or canal edge, announcing: 'Stop. Drop ahead. Check with your cane.'", bold_prefix="Drop-Off & Void Detection: ")
    add_bullet("If ground distance becomes closer by ≥ 20 cm, the system announces: 'Step or curb ahead.'", bold_prefix="Step-Up & Curb Detection: ")
    add_bullet("Front distance ≤ 150 cm triggers a warning ('Obstacle ahead at chest height, 1.5 meters'). Front distance ≤ 70 cm triggers an urgent command ('Stop. Obstacle ahead at chest height').", bold_prefix="Front Obstacle Alerts: ")

    # ═══════════════════════════════════════════════════════════════
    # SECTION 6: ACCESSIBILITY ENGINEERING & HUMAN FACTORS
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("6. Accessibility Engineering & WCAG AA Compliance")
    add_p(
        "GuideAI strictly implements Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and Android TalkBack semantics. "
        "Every UI element and interaction pattern is engineered specifically for non-visual and low-vision operation:"
    )
    add_bullet(
        "All interactive buttons and touch cards have a minimum touch target size of 48x48dp (with primary buttons exceeding 56x56dp). "
        "Touch areas feature wide gutters, preventing accidental activation of adjacent buttons by blind users scanning the screen with their fingers.",
        bold_prefix="Touch Target Sizing (Min 48x48dp): "
    )
    add_bullet(
        "The user interface uses a high-contrast dark theme (#09090D background with #FFFFFF text and #FCD34D yellow accents), "
        "achieving a contrast ratio of 14:1—far exceeding the WCAG AA requirement of 4.5:1. This optimizes readability for low-vision users with cataracts or macular degeneration.",
        bold_prefix="High Contrast Color Ratios (≥ 4.5:1): "
    )
    add_bullet(
        "Typography is built with scalable rem units (Typography scale in src/constants/typography.ts). "
        "The app respects system-level dynamic font scaling up to 200% without clipping or breaking layouts.",
        bold_prefix="Dynamic Typography & Font Scaling: "
    )
    add_bullet(
        "Every single TouchableOpacity and View component defines explicit accessibilityLabel, accessibilityHint, and accessibilityRole properties. "
        "Alert banners utilize accessibilityLiveRegion='assertive' to announce critical hazards immediately through TalkBack.",
        bold_prefix="TalkBack Semantic Hierarchy: "
    )

    add_heading_3("Multimodal Non-Visual Feedback Architecture")
    add_p(
        "GuideAI never relies on a single sensory modality to communicate safety information:"
    )
    add_bullet(
        "GuideAI features a custom priority-queued speech engine. Critical hazard announcements (risk 0) instantly interrupt lower-priority "
        "navigation instructions (risk 2). Furthermore, any queued announcement that becomes older than 4 seconds is automatically dropped as stale, "
        "preventing delayed warnings about hazards the user has already walked past.",
        bold_prefix="Priority-Queued Text-to-Speech (TTS): "
    )
    add_bullet(
        "A customized vibration engine generates distinct tactile rhythms per hazard tier. "
        "Critical hazards trigger three heavy pulses ([Heavy, Heavy, Heavy]), warnings trigger two medium pulses, and info triggers a single light tap. "
        "This allows users to feel danger levels even when environmental street noise (e.g., loud diesel trucks) drowns out voice output.",
        bold_prefix="Risk-Differentiated Haptic Feedback: "
    )

    # ═══════════════════════════════════════════════════════════════
    # SECTION 7: DATA PRIVACY & ACCOUNTLESS SECURITY ARCHITECTURE
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("7. Data Privacy & Accountless Security Model")
    add_p(
        "For blind pedestrians, onboarding barriers such as email confirmations, password strength rules, and two-factor SMS codes "
        "are frustrating and often exclusionary. GuideAI is designed around an Accountless Privacy Architecture:"
    )
    add_bullet(
        "When GuideAI is launched for the first time, it generates a random UUID (deviceId) stored in local AsyncStorage. "
        "Users are never prompted to create an account, enter a password, or submit an email address. "
        "The app is fully functional immediately upon installation.",
        bold_prefix="Zero-Login First Launch: "
    )
    add_bullet(
        "The user's display name, emergency contact phone numbers, and accessibility preferences reside strictly on the physical device. "
        "No central user database tracks user locations or personal identities.",
        bold_prefix="Complete On-Device Data Sovereignty: "
    )
    add_bullet(
        "The mobile application bundle contains zero sensitive server API keys (no Twilio secrets, Google Cloud keys, or database service roles). "
        "In the event of an SOS call, contacts are bundled in the request payload and sent to the server, which acts solely as an ephemeral relay.",
        bold_prefix="Zero Secrets in Client Bundle: "
    )

    # ═══════════════════════════════════════════════════════════════
    # SECTION 8: STEP-BY-STEP OPERATIONAL SCENARIOS
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("8. End-to-End Operational Walkthroughs")
    
    add_heading_2("Scenario A: Navigating a Typical Philippine Market Street")
    add_p(
        "1. Pedestrian says: 'Navigate to Public Market.'\n"
        "2. The voice parser identifies intent NAVIGATE, queries the local POI cache, locks coordinates, and begins walking guidance.\n"
        "3. TTS announces: 'Starting navigation to Dumaguete Public Market. Head forward along Real Street, 120 meters.'\n"
        "4. As the pedestrian walks, an approaching motorcycle comes into view 10 meters ahead on the right. "
        "The phone camera YOLO model detects the motorcycle; HazardTracker confirms growth over 1.2s and marks it as 'approaching.'\n"
        "5. Priority TTS interrupts: 'Approaching motorcycle on your right, 3 meters.' Synchronized medium haptic pulses alert the user.\n"
        "6. Approaching the corner, TTS alerts: 'In 30 meters, turn left onto Colon Street.' At 15 meters: 'Turn left onto Colon Street.' Cane vibrates.\n"
        "7. User arrives at destination: 'You have arrived at Dumaguete Public Market.'"
    )

    add_heading_2("Scenario B: Sudden Roadside Canal / Drop-Off Encounter")
    add_p(
        "1. Pedestrian is walking along an unpaved sidewalk margin. Ahead is an open roadside drainage ditch (gutters with missing concrete slab).\n"
        "2. The Smart Cane's downward laser ToF sensor scans the ground ahead of the cane tip. The reading jumps from normal 80 cm to 180 cm.\n"
        "3. The drop-streak confirms the reading for 2 consecutive samples (eliminating false sensor spikes).\n"
        "4. The ESP32 cane handle immediately activates continuous vibration and buzzer alert.\n"
        "5. The BLE telemetry packet alerts the mobile phone, which commands priority TTS: 'Stop. Drop ahead. Check with your cane.'\n"
        "6. The pedestrian pauses, sweeps the cane tip forward, verifies the ditch edge, and steps safely around it."
    )

    add_heading_2("Scenario C: Tripping, Fall, and Direct Emergency SOS Dispatch")
    add_p(
        "1. Pedestrian trips on an elevated tree root and falls to the pavement, dropping the cane.\n"
        "2. The cane's MPU6050 detects high-G deceleration followed by abnormal horizontal orientation, sending event 0x04 (Fall Detected).\n"
        "3. The phone screen turns high-contrast red and begins a loud spoken countdown: 'Fall detected. Emergency SOS activating in 5, 4, 3, 2, 1...'\n"
        "4. The user, unable to stand, lets the countdown expire.\n"
        "5. The native DirectSms module engages Android's SmsManager, texting family contacts directly from the SIM card with a live Google Maps link.\n"
        "6. Mobile screen displays emergency dial buttons for 911 and contacts; family members receive the location and navigate immediately to the scene."
    )

    # ═══════════════════════════════════════════════════════════════
    # SECTION 9: TECHNICAL DIRECTORY INVENTORY & REPOSITORY REFERENCE
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("9. Technical Codebase Anatomy & File Inventory")
    
    file_table = doc.add_table(rows=8, cols=3)
    file_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    file_table.autofit = False
    set_table_borders(file_table, "D1D5DB", "4")
    
    f_headers = ["Subsystem / Folder", "Key Source Files", "Implementation Scope & Purpose"]
    for j, h in enumerate(f_headers):
        cell = file_table.cell(0, j)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 80, 80, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    f_rows = [
        ("Mobile Client\n(mobile/src/services/detection)",
         "objectDetection.service.ts\nhazardClassifier.ts\nhazardTracker.ts\nhazardAnnouncer.ts\ncaneHazards.ts\nsources/cameraSource.ts\nsources/caneSource.ts",
         "Full perception pipeline: TFLite model execution, IoU frame tracking, distance & direction estimation, walking path filtering, cane sensor baseline learning, and unified announcement queue."),
        ("Navigation Subsystem\n(mobile/src/services/navigation)",
         "routing.service.ts\ngps.service.ts",
         "High-precision geocoder (POI cache, Photon, Nominatim), OSRM pedestrian routing, turn-by-turn instruction synthesizer, 30m turn warnings, and off-route rerouter."),
        ("Text Reader Subsystem\n(mobile/src/services/ocr)",
         "ocr.service.ts",
         "On-device Google ML Kit text recognition wrapper, phonetic sentence formatter, and scanning history store."),
        ("Emergency Subsystem\n(mobile/src/services/emergency\n& mobile/modules/direct-sms)",
         "sms.service.ts\nsos.service.ts\ncontacts.service.ts\nmodules/direct-sms/android/*",
         "Direct cellular SIM SMS dispatcher (SmsManager native module), fallback Express/Twilio client, contact sanitizer with Philippine 09/639 validation, and SOS countdown controller."),
        ("Speech & Haptics\n(mobile/src/services/tts & haptics)",
         "tts.service.ts\nhaptics.service.ts",
         "Crash-proof Android TTS voice queue with stale-drop logic and critical interrupt; risk-based vibration impact pattern generator."),
        ("Voice Subsystem\n(mobile/src/services/voice)",
         "commandParser.ts\nspeechRecognition.ts",
         "Bilingual English/Tagalog speech intent parser, confidence matcher, and spoken prompt synthesizer."),
        ("Hardware Companion\n(hardware/)",
         "PROTOCOL.md\nESP32 Firmware Specifications",
         "Complete BLE GATT protocol (service UUID, 10Hz sensor characteristic, event packets, write commands), threshold specs, and fail-safe logic."),
    ]

    f_col_widths = [Inches(1.8), Inches(2.2), Inches(2.5)]
    for i, row in enumerate(f_rows):
        for j, val in enumerate(row):
            cell = file_table.cell(i+1, j)
            cell.width = f_col_widths[j]
            bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 80, 80, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.name = "Calibri"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(31, 41, 55)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ═══════════════════════════════════════════════════════════════
    # SECTION 10: CONCLUSION & FUTURE ROADMAP
    # ═══════════════════════════════════════════════════════════════
    add_heading_1("10. Conclusion & Strategic Roadmap")
    add_p(
        "GuideAI represents a mature, field-hardened assistive navigation framework that bridges the gap between high-level "
        "academic artificial intelligence and the tactile, split-second life-safety needs of blind pedestrians in developing countries. "
        "By enforcing total offline autonomy, zero login friction, native direct-SIM cellular messaging, and tightly coupled IoT smart cane telemetry, "
        "the system establishes a new benchmark for accessible urban mobility."
    )
    add_p(
        "Key engineering milestones planned for future iterations include:"
    )
    add_bullet(
        "Expanding local image training sets across additional Philippine provinces to increase detection recall for open manholes and drainage canals beyond 70%.",
        bold_prefix="Extended Dataset Expansion: "
    )
    add_bullet(
        "Transitioning from float32 to INT8 quantized TFLite models to double camera inference frame rates while reducing battery consumption by 40%.",
        bold_prefix="Model INT8 Quantization: "
    )
    add_bullet(
        "Adding Cebuano, Ilocano, and Hiligaynon regional voice command lexicons to serve broader Philippine language communities.",
        bold_prefix="Regional Dialect Speech Models: "
    )
    add_bullet(
        "Miniaturizing the ESP32 circuit board into an injection-molded, weather-resistant (IP67) ergonomic handle attachment compatible with standard white canes.",
        bold_prefix="Custom Cane PCB Production: "
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(16)
    
    # Sign-off block
    sign_p = doc.add_paragraph()
    sign_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_sign1 = sign_p.add_run("GuideAI Research & Development Team\n")
    r_sign1.bold = True
    r_sign1.font.name = "Calibri"
    r_sign1.font.size = Pt(10)
    r_sign1.font.color.rgb = RGBColor(26, 54, 93)
    r_sign2 = sign_p.add_run("Document Approved for Implementation & Operational Review\nOctober 2026")
    r_sign2.font.name = "Calibri"
    r_sign2.font.size = Pt(9)
    r_sign2.font.color.rgb = RGBColor(107, 114, 128)

    # Save Document
    target_path = r"c:\Users\Darwin\Desktop\BUTA APP\GuideAI_Mobile_App_Architecture_and_Operation.docx"
    doc.save(target_path)
    print(f"Document successfully created and saved to: {target_path}")

if __name__ == "__main__":
    create_document()
