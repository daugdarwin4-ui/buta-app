# GuideAI Cane ↔ App Bluetooth Protocol (v1)

The cane device (ESP32) talks to the GuideAI app over **Bluetooth Low Energy (BLE)**.
The ESP32 is the BLE *peripheral* (it advertises); the phone is the *central* (it connects).

The app side already has a slot for this: `mobile/src/services/detection/sources/caneSource.ts`
(`pushReading()` and `setDeviceConnected()`). The Bluetooth transport itself is added when the
hardware arrives, so it can be tested on real devices.

---

## 1. Safety rule: the cane works on its own

The cane must warn the user **even if the phone is disconnected, asleep, or out of battery**.
The ESP32 drives its own vibration motor and buzzer from the same thresholds the app uses
(section 5). The app adds voice, SOS texting, and navigation on top.

---

## 2. Advertising

| Item | Value |
|---|---|
| Device name | `GuideAI-Cane` |
| Advertised service | GuideAI Cane Service (below) |

---

## 3. GATT services

### GuideAI Cane Service — `6e7a0001-4f1b-4c1d-9b3a-2a6e8c9d0b00`

| Characteristic | UUID | Properties | Purpose |
|---|---|---|---|
| Sensor readings | `6e7a0002-4f1b-4c1d-9b3a-2a6e8c9d0b00` | Notify | Distance readings, ~10 per second |
| Events | `6e7a0003-4f1b-4c1d-9b3a-2a6e8c9d0b00` | Notify | Button presses, falls |
| Commands | `6e7a0004-4f1b-4c1d-9b3a-2a6e8c9d0b00` | Write | Phone → cane (vibrate, buzz) |

### Standard Battery Service — `0x180F`

| Characteristic | UUID | Properties | Purpose |
|---|---|---|---|
| Battery level | `0x2A19` | Read, Notify | 0–100 % |

---

## 4. Message formats

All multi-byte numbers are **little-endian**.

### 4.1 Sensor readings (4 bytes, notify ~10 Hz)

| Bytes | Type | Field | Meaning |
|---|---|---|---|
| 0–1 | uint16 | `frontCm` | Front ultrasonic (RCWL-1601), chest/head height |
| 2–3 | uint16 | `groundCm` | Down-angled laser (VL53L0X), ground ahead of the tip |

Special values:

| Value | Meaning |
|---|---|
| `0xFFFF` | No valid reading (sensor error) — the app ignores it |
| front `400` | Nothing within range (clear) |
| ground `200` | Nothing within range — **the app treats this as a drop** (nothing below) |

### 4.2 Events (1 byte, notify)

| Value | Event | App action |
|---|---|---|
| `0x01` | SOS button held 2 seconds | Start the SOS countdown (any screen) |
| `0x02` | Mode button short press | "Where am I?" |
| `0x03` | Mode button long press | Open voice commands |
| `0x04` | Fall detected (MPU6050) | Start the SOS countdown; user can cancel |

### 4.3 Commands (2 bytes, write)

| Byte 0 | Byte 1 | Action |
|---|---|---|
| `0x01` | pattern: `1` short, `2` double, `3` long | Vibrate (e.g. before a navigation turn) |
| `0x02` | duration in 100 ms units | Buzzer |

---

## 5. Hazard thresholds (keep the firmware and the app in sync)

Defined in the app at `mobile/src/services/detection/caneHazards.ts` (`CANE_THRESHOLDS`):

| Rule | Value |
|---|---|
| Front obstacle: warning | ≤ 150 cm |
| Front obstacle: stop (critical) | ≤ 70 cm |
| Normal ground distance (starting value, then learned) | 80 cm |
| Drop: ground farther than normal by | ≥ 25 cm, for 2 readings in a row |
| Step/curb: ground closer than normal by | ≥ 20 cm |

Suggested on-cane feedback: warning → short pulses; critical → continuous vibration + buzzer.
