# 🌟 GuideAI — Real-Time Visual Assistance & Navigation System

**GuideAI** is an AI-powered assistive mobile application built for visually impaired and blind pedestrians in the Philippines. It delivers real-time hazard detection, pedestrian turn-by-turn navigation, camera sign reading, and emergency SOS dispatch with WCAG AA compliance and TalkBack/VoiceOver support.

---

## 🏗️ Architecture Overview

```
├── mobile/                 # React Native / Expo (TypeScript) client
│   ├── app/                # Expo Router file-based screens
│   │   ├── onboarding.tsx  # First-launch spoken intro (no login or sign-up)
│   │   ├── (tabs)/         # Detection, Navigation, OCR, Voice, Profile
│   │   └── emergency/      # SOS Trigger, Contacts Management
│   ├── src/
│   │   ├── components/     # Accessible UI components (AccessibleButton, HazardBanner, TurnByTurnPanel, SOSButton)
│   │   ├── services/       # Detection, GPS, routing, OCR, TTS queue, Haptics, SOS + on-device contacts
│   │   ├── hooks/          # useObjectDetection, useGPS, useTextReader, useEmergency, useVoiceAssistant
│   │   ├── stores/         # Zustand stores (User on-device data, Navigation, Detection)
│   │   └── constants/      # WCAG AA Colors, Typography, Hazards, Philippine defaults
│
├── server/                 # Node.js / Express (TypeScript) backend
│   ├── src/
│   │   ├── routes/         # Emergency SOS, Navigation proxy, OCR Vision endpoints
│   │   ├── controllers/    # Request validation with Zod schemas
│   │   └── services/       # Twilio SMS client, Google Maps Directions, Cloud Vision OCR
│   └── __tests__/          # Integration tests (Supertest + Jest)
│
└── model/                  # YOLOv11 training pipeline & ONNX export guide
```

---

## ✨ Key Capabilities

1. 👁️ **Hazard & Obstacle Detection — phone camera, cane device, or both** (user setting): both sources feed one announcer (most dangerous first, max 2 per update, re-announces when a hazard gets more dangerous). Cane rules: front obstacle at chest height, drop ahead, step/curb (see `hardware/PROTOCOL.md`). *Both sources run in demo mode until the YOLO model (`model/EXPORT_FOR_APP.md`) and the ESP32 cane are connected.*
2. 🗺️ **Turn-by-Turn Walking Navigation**: Free OpenStreetMap routing called directly from the phone. Speaks the live distance to each turn, warns 30 m before turns, and reroutes automatically when the user goes off route. Never invents a route when a place or route cannot be found.
3. 📄 **Text Reader**: On-device Google ML Kit text recognition. Works offline, no server needed.
4. 🆘 **Emergency SOS**: 5-second spoken countdown, then texts every emergency contact **directly from the phone's SIM** with a Google Maps link (works without internet). The Express server + Twilio is a backup when reachable. "Mark as Resolved" texts the same contacts that the user is safe.
5. 🎙️ **Voice Assistant**: Android's native speech recognizer (English-Philippines), with English and Tagalog commands ("Where am I" / "Nasaan ako", "Navigate to" / "Pumunta sa", "Help" / "Tulong").
6. ♿ **Blind-first design**: No login, large single-column targets, TalkBack labels, spoken feedback for every action and error, and hazard warnings that are never cut off by less urgent speech.

---

## ⚡ Quick Start

### 1. Backend Server
```bash
cd server
npm install
npm run dev
```

### 2. Mobile App (Expo)
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start
```

### 3. Run Tests
```bash
# Server integration tests
cd server && npm test
```

---

## 🔒 Security & Privacy
- Zero backend secrets exposed to client app. All sensitive operations (Twilio, Google Cloud Vision, Supabase Service Role) reside strictly in the Express server.
- No user accounts: name, settings and emergency contacts are stored only on the phone and sent with each SOS request. Supabase is used by the server only, to log SOS events (run `server/supabase_migration_remove_accounts.sql`).
