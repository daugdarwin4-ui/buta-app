# GuideAI Smart Cane — Parts List

The complete parts list for the ESP32 cane device, as agreed on 29–30 September 2026, with every
change made along the way. Prices are rough estimates for Shopee, Lazada and local electronics shops
(e-Gizmo, Makerlab); check them before buying.

How the cane talks to the app is in [PROTOCOL.md](PROTOCOL.md).

---

## 1. Core parts

| ✔ | Qty | Part | What to search | What it's for | Est. price |
|---|---|---|---|---|---|
| ☐ | 2 | **ESP32 DevKit V1** (ESP32-WROOM-32, USB-C if available) | `ESP32 DevKit V1` | Main board with built-in Bluetooth. 1 to use, 1 spare. | ₱250–400 each |
| ☐ | 2 | **RCWL-1601 ultrasonic sensor** (must say it works at **3.3 V**) | `RCWL-1601 ultrasonic 3.3V` | Front sensor for obstacles at head and chest height. 1 to use, 1 spare (or side-facing). | ₱60–150 each |
| ☐ | 1 | **VL53L0X laser distance (ToF) sensor**, I2C | `VL53L0X` | Points down at the ground ahead of the cane tip; detects drops (stairs down, canals, holes) and steps/curbs. | ₱200–450 (estimate; usually cheaper than the VL53L1X, which was ₱400–650) |
| ☐ | 1 (2 if under ₱150) | **MPU6050 GY-521**, **straight-pin soldered** version | `MPU6050 GY-521` | Detects falls, so the app can start an automatic SOS. | ₱100–180 |
| ☐ | 3 | **Coin vibration motor, 3 V** with wire | `coin vibration motor 1027 3V with wire` | Vibrates in the handle. 1 to use, 2 spares (the thin wires break easily). | ₱45–120 total |
| ☐ | 1 pack (10 pcs) | **NPN transistor**, S8050 or 2N2222 | `S8050 transistor` / `2N2222 transistor` | Switches the vibration motor (and the buzzer). The ESP32 pin can't power the motor directly. | ₱30–60 |
| ☐ | 1 pack (10 pcs) | **Diode**, 1N4148 or 1N4007 | `1N4148 diode` / `1N4007 diode` | Protects the ESP32 from the motor's voltage spike when it switches off. | ₱20–40 |
| ☐ | 1 | **Active buzzer** | `active buzzer` | Loud warning when an obstacle is very close. | ₱20–40 |
| ☐ | 2 | **Large 16 mm push buttons** | `16mm push button` | 1 SOS button (hold 2 s), 1 mode button ("Where am I?" / voice). | ₱30–80 each |
| ☐ | 2 | **18650 rechargeable battery, 3.7 V**, genuine (Samsung, LG or Sony) | `18650 Samsung` | Power. | ₱150–300 each |
| ☐ | 1 | **Battery holder for 2 × 18650**, wired in parallel | `18650 battery holder 2 slot` | Holds the batteries. | ₱40–80 |
| ☐ | 1 | **TP4056 USB-C charger module**, the version "with protection" | `TP4056 type C with protection` | Recharges the batteries safely. | ₱30–60 |
| ☐ | 1 | **Slide on/off switch** | `slide switch` | Power switch. | ₱10–30 |
| ☐ | 1 | **Folding white cane** | `folding white cane` | The cane everything mounts on. | ₱300–700 |

## 2. Resistors

Buy **one assorted resistor kit** (search `resistor kit assorted 1/4W` or `resistor kit 30 values`;
300–600 pieces across 20–30 values, about ₱100–150). Choose **1/4 W (0.25 W)**, not 1 W or 2 W.
From the kit, this build uses:

| Value | Qty | Used for |
|---|---|---|
| **1 kΩ** | 1 (2 if the buzzer also uses a transistor) | Base resistor for the transistor that switches the vibration motor |
| **10 kΩ** | 2 | Pull-down resistors for the SOS button and the mode button, so they read a clean 0 or 1 |
| **220 Ω or 330 Ω** | 1–2 | Only if you add a small status LED (e.g. "on" or "Bluetooth connected") |

Not needed:
- **No voltage divider (1 kΩ / 2 kΩ)** for the ultrasonic sensor: that was only for the HC-SR04, and the RCWL-1601 works at 3.3 V directly.
- **No I2C pull-ups** for the VL53L0X and MPU6050: both boards already have them built in.

## 3. Tools and build materials (skip what you already have)

| ✔ | Item | Est. price |
|---|---|---|
| ☐ | Breadboard + jumper wires (male-male and male-female) | ₱150–250 |
| ☐ | Perfboard (solderable board for the final build) + wires + heat-shrink tubing | ₱150–250 |
| ☐ | Soldering iron kit | ₱350–700 |
| ☐ | Multimeter (for measuring voltage) | ₱300–500 |
| ☐ | Enclosure: 3D-printed case or small ABS project box, plus hose clamps and velcro to attach it to the cane | ₱200–500 |

## 4. Estimated total

- Core parts: about **₱2,500–4,000**
- Tools, if you need them: about **₱1,000–2,000**

---

## 5. Decisions we made (and why)

| Decision | Why |
|---|---|
| **ESP32**, not Arduino or Raspberry Pi | Bluetooth Low Energy is built in, it's small, runs for hours on a battery, and is cheap. Arduino Uno/Nano has no Bluetooth; Raspberry Pi is heavy, power-hungry, slow to start and costs ₱4,000+. |
| **RCWL-1601**, not HC-SR04 | Works at 3.3 V like the ESP32, so it connects directly. The HC-SR04 needs 5 V, a boost converter and a resistor divider on its echo wire. |
| **VL53L0X**, not VL53L1X | Same wiring. Its ~2 m range is enough to check the ground just ahead, it reads faster, and it's cheaper and easier to find. (The app treats a ground reading of 200 cm as "nothing below", i.e. a drop.) |
| **MPU6050 straight-pin soldered**, not "Unsoldered" or "Chinese Chip" | Plugs straight into the breadboard. The "Chinese Chip" version is often a copy that common libraries don't recognise ("Failed to find MPU6050 chip"). |
| **Bare coin motor + transistor + diode**, not a vibration motor module | No trusted module sellers were found. The bare parts are generic and easy to get; the motor draws 60–90 mA, more than an ESP32 pin can safely give (~20 mA), so the transistor does the switching. |
| ~~No MT3608 boost converter~~ → **MT3608 is used** (updated with [WIRING.md](WIRING.md)) | First it was only meant for the HC-SR04. When the power wiring was planned, it turned out the ESP32 needs about 5 V on `VIN`, and one 18650 gives only 3.0–4.2 V, so the MT3608 now powers the ESP32 (set to 5.0 V). |
| **No ESP32-CAM** | Too weak for object recognition; the phone camera does that job. |

## 6. Buying tips

- **Buy from sellers with local stock** (ships from the Philippines). Shipping from China can take 2–3 weeks.
- **Seller checks:** rating **4.8 or higher**, many items sold, reviews with **photos of the actual item**.
- **RCWL-1601:** confirm the listing says it works at **3.3 V**; some clones only claim 5 V.
- **18650 batteries:** buy genuine ones. Fakes ("9900 mAh" for ₱50) can overheat and catch fire.
- **MPU6050:** check that the pins stick out on the underside so it sits flat on the breadboard.
- Buy the small parts (motor, transistor, diode, resistors) from the **same store** as the rest to save on shipping. Local shops like e-Gizmo sell them over the counter. An old phone also has the same coin motor inside.

## 7. Wiring notes agreed so far

**Vibration motor through the transistor** (the active buzzer is switched the same way):

```
3.3V ───────┬──────────────┐
            │              │
         Motor (+)      Diode (stripe side here)
         Motor (−)      Diode (other side)
            │              │
            └──────┬───────┘
                   │
              Transistor C (collector)
ESP32 GPIO ─[1kΩ]─ Transistor B (base)
              Transistor E (emitter)
                   │
                  GND
```

- In code: pin HIGH = vibrate, pin LOW = stop.
- **VL53L0X and MPU6050** share the I2C bus: VCC (3.3 V), GND, SDA, SCL to the same ESP32 pins.
- **RCWL-1601:** VCC (3.3 V), GND, Trig and Echo to two ESP32 GPIO pins; no divider needed.
- **Buttons:** one side to 3.3 V, the other to a GPIO pin with a 10 kΩ pull-down to GND.

The full pin-by-pin wiring diagram and the ESP32 program will be written when the parts arrive.

## 8. Before the parts arrive (optional)

You can test the ESP32 code in a browser simulator:
- **[Wokwi](https://wokwi.com)** — best ESP32 simulator; has the MPU6050, HC-SR04 (use it in place of the RCWL-1601), buzzers and buttons. Use an LED in place of the vibration motor.
- **[Tinkered.ai](https://www.tinkered.ai/)** — AI drafts the circuit and code; check its power wiring before trusting it.
- Neither simulator supports Bluetooth, so print readings to the Serial monitor; the Bluetooth link to the app is tested on the real board.

## 9. Next steps when the parts arrive

1. Test each sensor alone on the breadboard (ultrasonic, laser, motion, motor, buzzer, buttons).
2. Load the ESP32 program (sensor readings, on-cane warnings, Bluetooth per [PROTOCOL.md](PROTOCOL.md)).
3. Connect the cane to the app (Settings → detection source: Cane or Both) and test live readings.
4. Move the circuit to perfboard and mount it on the cane.
