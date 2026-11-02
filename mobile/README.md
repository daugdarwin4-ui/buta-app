# GuideAI — Mobile Client (React Native / Expo)

GuideAI is an intelligent, real-time visual assistance application designed specifically for visually impaired pedestrians in the Philippines. It combines on-device YOLO object detection, turn-by-turn pedestrian voice navigation, OCR camera text reading, and an Emergency SOS alert system with continuous TalkBack/VoiceOver accessibility.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- Android Studio / Android device with USB debugging enabled
- Expo Go / Expo Dev Client (`npx expo run:android`)

### Installation

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Create your `.env` configuration file:
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LOCAL_IP>:3000
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. Start the Expo development server:
   ```bash
   npx expo start
   ```

---

## 📱 Features & Modules

### 1. Object & Hazard Detection (`/detection`)
- **YOLOv11 ONNX runtime**: Real-time object recognition for pedestrians, vehicles, stairs, potholes, poles, and barriers.
- **Directional & Distance Mapping**: Estimates obstacle direction (left/ahead/right) and proximity with audible cues.
- **Priority Queue & Throttle**: Suppresses repeated announcements within 5 seconds to prevent audio fatigue.

### 2. Turn-by-Turn GPS Navigation (`/navigation`)
- Continuous GPS pedestrian tracking with heading compass.
- Turn instructions announced via Text-To-Speech (TTS).
- Real-time dark vector map with route visualization.

### 3. OCR Text Reader (`/text-reader`)
- Fast camera snapshot text reader for signs, labels, and street markers.
- Automatic danger sign detection (`WARNING`, `DANGER`, `CAUTION`, `NO ENTRY`).
- Instant Text-To-Speech playback and scan history.

### 4. Emergency SOS (`/emergency/sos`)
- 5-second countdown with voice cancellation and haptic feedback.
- Sends live GPS coordinates and Google Maps pin to emergency contacts via Twilio SMS.
- Quick access to Philippine emergency hotlines (911, 117, 143, 160).

### 5. Voice Assistant (`/voice`)
- Hands-free voice commands via speech recognition (`"Navigate to..."`, `"Read text"`, `"Scan surroundings"`, `"Emergency SOS"`).
- Animated real-time waveform and TalkBack-readable command list.

---

## ♿ Accessibility Standards (WCAG 2.1 AA)

- **TalkBack / VoiceOver Optimization**: All interactive elements have descriptive `accessibilityLabel`, `accessibilityHint`, and `accessibilityRole`.
- **High-Contrast Dark Theme**: Pure black background (`#000000`) with high-contrast text (`#F8FAFC`, ratio > 7:1).
- **Minimum Touch Targets**: All buttons and tappable regions meet the 48×48dp Android requirement.
- **Multimodal Feedback**: Visual HUD, haptic vibration pulses, and prioritized audio speech.
