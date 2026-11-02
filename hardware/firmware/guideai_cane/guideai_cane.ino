/*
  GuideAI smart cane firmware (ESP32 DevKit V1)

  Pins:              hardware/WIRING.md
  Bluetooth format:  hardware/PROTOCOL.md
  Thresholds:        same as CANE_THRESHOLDS in mobile/src/services/detection/caneHazards.ts

  SIMULATION 1  = Wokwi: the VL53L0X laser is replaced by a slider on GPIO27, Bluetooth is off
                  (Wokwi cannot simulate it), and the buzzer plays a tone so you can hear it.
  SIMULATION 0  = the real cane. Needs the "VL53L0X" library by Pololu (Arduino Library Manager).

  The cane warns on its own (motor + buzzer) even when the phone is not connected.
  Serial Monitor (115200): readings and events are printed; type v1 / v2 / v3 (vibrate short /
  double / long) or b5 (buzz 0.5 s) to send the same commands the phone app sends.
*/
#define SIMULATION 1

#include <Wire.h>
#include <math.h>
#if !SIMULATION
#include <VL53L0X.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#endif

// ── pins (hardware/WIRING.md) ──
const int PIN_TRIG = 17;       // RCWL-1601 Trig
const int PIN_ECHO = 16;       // RCWL-1601 Echo
const int PIN_SDA = 21;        // VL53L0X + MPU6050
const int PIN_SCL = 22;
const int PIN_MOTOR = 25;      // through the S8050 transistor
const int PIN_BUZZER = 26;     // through the second S8050
const int PIN_SOS = 32;        // 3V3 -> button -> pin, 10k pull-down
const int PIN_MODE = 33;
const int PIN_BATTERY = 34;    // optional 100k/100k divider from the battery
const int PIN_SIM_LASER = 27;  // Wokwi only: slider in place of the laser

// ── hazard thresholds (keep in sync with the app) ──
const uint16_t FRONT_CRITICAL_CM = 70;
const uint16_t FRONT_WARNING_CM = 150;
const float GROUND_DEFAULT_CM = 80;
const float DROP_MARGIN_CM = 25;
const float STEP_MARGIN_CM = 20;
const float BASELINE_LEARN_BAND_CM = 15;
const int DROP_CONFIRM_READINGS = 2;

// ── special reading values (PROTOCOL.md 4.1) ──
const uint16_t FRONT_CLEAR_CM = 400;
const uint16_t GROUND_CLEAR_CM = 200;
const uint16_t NO_READING = 0xFFFF;

// ── events (PROTOCOL.md 4.2) and commands (4.3) ──
const uint8_t EVENT_SOS = 0x01;
const uint8_t EVENT_WHERE_AM_I = 0x02;
const uint8_t EVENT_VOICE = 0x03;
const uint8_t EVENT_FALL = 0x04;
const uint8_t CMD_VIBRATE = 0x01;
const uint8_t CMD_BUZZ = 0x02;

// ── timing ──
const unsigned long SENSOR_PERIOD_MS = 100;    // ~10 readings per second
const unsigned long IMU_PERIOD_MS = 20;        // 50 Hz, fast enough to catch an impact
const unsigned long STATUS_PERIOD_MS = 1000;
const unsigned long BATTERY_PERIOD_MS = 30000;
const unsigned long DEBOUNCE_MS = 30;
const unsigned long SOS_HOLD_MS = 2000;
const unsigned long MODE_LONG_MS = 1000;

// ── fall detection: a hard impact, then the cane lies still on the ground ──
// The MPU6050 lies flat in the box, so its Y axis runs along the cane shaft.
#if SIMULATION
const float IMPACT_G = 1.8;                    // Wokwi's sliders stop at about 2 g
const unsigned long FALL_WINDOW_MS = 10000;    // time to change the sliders by hand
const float ACCEL_LSB_PER_G = 16384;           // default +-2 g range
#else
const float IMPACT_G = 2.5;
const unsigned long FALL_WINDOW_MS = 3000;
const float ACCEL_LSB_PER_G = 4096;            // +-8 g, so hard impacts are not clipped
#endif
const float LYING_ANGLE_DEG = 65;              // shaft this far from vertical = lying down
const float UPRIGHT_ANGLE_DEG = 45;
const float STILL_TOLERANCE_G = 0.15;
const unsigned long LYING_STILL_MS = 2000;
const uint8_t MPU_ADDR = 0x68;

enum Level { LEVEL_NONE, LEVEL_WARNING, LEVEL_CRITICAL };
const char *LEVEL_NAMES[] = {"clear", "WARNING", "CRITICAL"};

// ─────────────────────────────── state ───────────────────────────────
uint16_t frontCm = FRONT_CLEAR_CM;
uint16_t groundCm = (uint16_t)GROUND_DEFAULT_CM;
float groundBaseline = GROUND_DEFAULT_CM;
int dropStreak = 0;
Level level = LEVEL_NONE;
const char *reason = "";
bool mpuOk = false;

// one-shot vibration / buzz from a command or a button confirmation
uint8_t patternType = 0;            // 0 none, 1 short, 2 double, 3 long
unsigned long patternStart = 0;
unsigned long buzzUntil = 0;
bool motorOn = false, buzzerOn = false;

struct Button {
  int pin;
  bool stable, lastRaw, longFired;
  unsigned long changedAt, pressedAt;
};
Button sosButton = {PIN_SOS, false, false, false, 0, 0};
Button modeButton = {PIN_MODE, false, false, false, 0, 0};

enum FallState { FALL_IDLE, FALL_WAIT, FALL_REPORTED };
FallState fallState = FALL_IDLE;
unsigned long impactAt = 0, stillSince = 0;

unsigned long lastSensor = 0, lastImu = 0, lastStatus = 0, lastBattery = 0;
String serialLine;

#if !SIMULATION
VL53L0X laser;
bool laserOk = false;

const char *SERVICE_UUID = "6e7a0001-4f1b-4c1d-9b3a-2a6e8c9d0b00";
const char *READINGS_UUID = "6e7a0002-4f1b-4c1d-9b3a-2a6e8c9d0b00";
const char *EVENTS_UUID = "6e7a0003-4f1b-4c1d-9b3a-2a6e8c9d0b00";
const char *COMMANDS_UUID = "6e7a0004-4f1b-4c1d-9b3a-2a6e8c9d0b00";
BLECharacteristic *readingsChar = nullptr;
BLECharacteristic *eventsChar = nullptr;
BLECharacteristic *batteryChar = nullptr;
volatile bool phoneConnected = false;
// commands arrive on the Bluetooth task; the main loop applies them
volatile bool commandPending = false;
volatile uint8_t pendingCommand[2];
#endif

// ─────────────────────────────── outputs ───────────────────────────────
void setMotor(bool on) {
  if (on == motorOn) return;
  motorOn = on;
  digitalWrite(PIN_MOTOR, on ? HIGH : LOW);
}

void setBuzzer(bool on) {
  if (on == buzzerOn) return;
  buzzerOn = on;
#if SIMULATION
  if (on) tone(PIN_BUZZER, 2000);   // Wokwi's buzzer needs a tone to make a sound
  else noTone(PIN_BUZZER);
#else
  digitalWrite(PIN_BUZZER, on ? HIGH : LOW);   // active buzzer: on/off is enough
#endif
}

void vibrate(uint8_t pattern) {
  patternType = pattern;
  patternStart = millis();
}

// Is the one-shot vibration pattern on right now?
bool patternActive(unsigned long now) {
  if (patternType == 0) return false;
  unsigned long t = now - patternStart;
  switch (patternType) {
    case 1: if (t < 150) return true; break;                          // short
    case 2: if (t < 120 || (t >= 240 && t < 360)) return true;        // double
            if (t < 360) return false; break;
    case 3: if (t < 600) return true; break;                          // long
  }
  if (t >= 600) patternType = 0;
  return false;
}

void updateFeedback(unsigned long now) {
  bool motor = patternActive(now);
  bool buzz = now < buzzUntil;
  if (level == LEVEL_CRITICAL) {
    motor = true;                                   // continuous vibration
    buzz = buzz || (now / 100) % 2 == 0;            // fast beeping
  } else if (level == LEVEL_WARNING) {
    motor = motor || (now % 600) < 120;             // short pulses
  }
  setMotor(motor);
  setBuzzer(buzz);
}

void handleCommand(uint8_t command, uint8_t value) {
  if (command == CMD_VIBRATE && value >= 1 && value <= 3) {
    vibrate(value);
    Serial.printf("[COMMAND] vibrate pattern %u\n", value);
  } else if (command == CMD_BUZZ) {
    buzzUntil = millis() + value * 100UL;
    Serial.printf("[COMMAND] buzz %u ms\n", value * 100U);
  } else {
    Serial.printf("[COMMAND] unknown 0x%02X 0x%02X\n", command, value);
  }
}

// ─────────────────────────────── Bluetooth ───────────────────────────────
#if !SIMULATION
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    phoneConnected = true;
  }
  void onDisconnect(BLEServer *) override {
    phoneConnected = false;
    BLEDevice::startAdvertising();   // let the phone find the cane again
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    auto value = c->getValue();
    if (value.length() < 2 || commandPending) return;
    pendingCommand[0] = (uint8_t)value[0];
    pendingCommand[1] = (uint8_t)value[1];
    commandPending = true;
  }
};

void setupBluetooth() {
  BLEDevice::init("GuideAI-Cane");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *cane = server->createService(SERVICE_UUID);
  readingsChar = cane->createCharacteristic(READINGS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  readingsChar->addDescriptor(new BLE2902());
  eventsChar = cane->createCharacteristic(EVENTS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  eventsChar->addDescriptor(new BLE2902());
  BLECharacteristic *commands = cane->createCharacteristic(COMMANDS_UUID, BLECharacteristic::PROPERTY_WRITE);
  commands->setCallbacks(new CommandCallbacks());
  cane->start();

  BLEService *battery = server->createService(BLEUUID((uint16_t)0x180F));
  batteryChar = battery->createCharacteristic(BLEUUID((uint16_t)0x2A19),
                                              BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  batteryChar->addDescriptor(new BLE2902());
  battery->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
}
#endif

void sendReadings() {
#if !SIMULATION
  if (!phoneConnected) return;
  uint8_t data[4] = {(uint8_t)(frontCm & 0xFF), (uint8_t)(frontCm >> 8),
                     (uint8_t)(groundCm & 0xFF), (uint8_t)(groundCm >> 8)};
  readingsChar->setValue(data, 4);
  readingsChar->notify();
#endif
}

void sendEvent(uint8_t event, const char *name) {
  Serial.printf("[EVENT] %s (0x%02X)\n", name, event);
#if !SIMULATION
  if (!phoneConnected) return;
  eventsChar->setValue(&event, 1);
  eventsChar->notify();
#endif
}

void updateBattery() {
#if !SIMULATION
  // 100k/100k divider halves the battery voltage; 3.3 V = empty, 4.2 V = full
  int millivolts = analogReadMilliVolts(PIN_BATTERY) * 2;
  uint8_t percent = (uint8_t)constrain((millivolts - 3300) * 100 / (4200 - 3300), 0, 100);
  batteryChar->setValue(&percent, 1);
  if (phoneConnected) batteryChar->notify();
#endif
}

// ─────────────────────────────── sensors ───────────────────────────────
uint16_t readFrontCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long echoUs = pulseIn(PIN_ECHO, HIGH, 25000UL);   // 25 ms = a little over 4 m
  if (echoUs == 0) return FRONT_CLEAR_CM;                   // no echo: nothing in range
  uint16_t cm = echoUs / 58;
  return cm > FRONT_CLEAR_CM ? FRONT_CLEAR_CM : cm;
}

uint16_t readGroundCm() {
#if SIMULATION
  return map(analogRead(PIN_SIM_LASER), 0, 4095, 0, GROUND_CLEAR_CM);
#else
  if (!laserOk) return NO_READING;
  uint16_t mm = laser.readRangeContinuousMillimeters();
  if (laser.timeoutOccurred()) return NO_READING;
  uint16_t cm = mm / 10;
  return cm >= GROUND_CLEAR_CM ? GROUND_CLEAR_CM : cm;      // out of range = nothing below
#endif
}

// Same rules as CaneHazardDetector in the app.
void evaluateHazards() {
  Level frontLevel = LEVEL_NONE, groundLevel = LEVEL_NONE;
  const char *frontReason = "", *groundReason = "";

  if (frontCm != NO_READING && frontCm <= FRONT_WARNING_CM) {
    bool critical = frontCm <= FRONT_CRITICAL_CM;
    frontLevel = critical ? LEVEL_CRITICAL : LEVEL_WARNING;
    frontReason = critical ? "stop, obstacle ahead at chest height" : "obstacle ahead at chest height";
  }

  if (groundCm != NO_READING) {
    float g = groundCm;
    bool isDrop = g >= groundBaseline + DROP_MARGIN_CM;
    bool isStep = g <= groundBaseline - STEP_MARGIN_CM;
    dropStreak = isDrop ? dropStreak + 1 : 0;
    if (isDrop && dropStreak >= DROP_CONFIRM_READINGS) {
      groundLevel = LEVEL_CRITICAL;
      groundReason = "stop, drop ahead";
    } else if (isStep) {
      groundLevel = LEVEL_WARNING;
      groundReason = "step or curb ahead";
    } else if (fabsf(g - groundBaseline) <= BASELINE_LEARN_BAND_CM) {
      groundBaseline = groundBaseline * 0.9f + g * 0.1f;     // learn how this user holds the cane
    }
  }

  Level newLevel = frontLevel >= groundLevel ? frontLevel : groundLevel;
  const char *newReason = frontLevel >= groundLevel ? frontReason : groundReason;
  if (newLevel != level || newReason != reason) {
    level = newLevel;
    reason = newReason;
    if (level == LEVEL_NONE) Serial.println("[HAZARD] clear");
    else Serial.printf("[HAZARD] %s: %s\n", LEVEL_NAMES[level], reason);
  }
}

bool setupMpu() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);   // PWR_MGMT_1: wake up
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;
#if !SIMULATION
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);   // ACCEL_CONFIG: +-8 g
  Wire.write(0x10);
  if (Wire.endTransmission() != 0) return false;
#endif
  return true;
}

bool readAccel(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);   // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, (uint8_t)6) != 6) return false;
  int16_t raw[3];
  for (int i = 0; i < 3; i++) raw[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  ax = raw[0] / ACCEL_LSB_PER_G;
  ay = raw[1] / ACCEL_LSB_PER_G;
  az = raw[2] / ACCEL_LSB_PER_G;
  return true;
}

void updateFall(unsigned long now) {
  float ax, ay, az;
  if (!mpuOk || !readAccel(ax, ay, az)) return;
  float total = sqrtf(ax * ax + ay * ay + az * az);
  if (total < 0.05f) return;
  float shaftAngle = acosf(fminf(1.0f, fabsf(ay) / total)) * 180.0f / PI;   // 0 = upright
  bool lyingStill = shaftAngle > LYING_ANGLE_DEG && fabsf(total - 1.0f) < STILL_TOLERANCE_G;

  switch (fallState) {
    case FALL_IDLE:
      if (total > IMPACT_G) {
        fallState = FALL_WAIT;
        impactAt = now;
        stillSince = 0;
        Serial.printf("[FALL] impact %.1f g, watching...\n", total);
      }
      break;
    case FALL_WAIT:
      if (lyingStill) {
        if (stillSince == 0) stillSince = now;
        if (now - stillSince >= LYING_STILL_MS) {
          fallState = FALL_REPORTED;
          vibrate(3);
          sendEvent(EVENT_FALL, "fall detected");
        }
      } else {
        stillSince = 0;
        if (now - impactAt > FALL_WINDOW_MS) fallState = FALL_IDLE;   // it was just a tap
      }
      break;
    case FALL_REPORTED:
      if (shaftAngle < UPRIGHT_ANGLE_DEG) fallState = FALL_IDLE;     // picked up again
      break;
  }
}

// ─────────────────────────────── buttons ───────────────────────────────
void updateButton(Button &b, unsigned long now) {
  bool raw = digitalRead(b.pin) == HIGH;   // pull-down: pressed = HIGH
  if (raw != b.lastRaw) {
    b.lastRaw = raw;
    b.changedAt = now;
  }
  if (now - b.changedAt >= DEBOUNCE_MS && raw != b.stable) {
    b.stable = raw;
    if (raw) {
      b.pressedAt = now;
      b.longFired = false;
    } else if (b.pin == PIN_MODE && !b.longFired) {
      vibrate(1);
      sendEvent(EVENT_WHERE_AM_I, "MODE short press: where am I?");
    }
  }
  if (b.stable && !b.longFired) {
    if (b.pin == PIN_SOS && now - b.pressedAt >= SOS_HOLD_MS) {
      b.longFired = true;
      vibrate(3);
      sendEvent(EVENT_SOS, "SOS held 2 s");
    } else if (b.pin == PIN_MODE && now - b.pressedAt >= MODE_LONG_MS) {
      b.longFired = true;
      vibrate(2);
      sendEvent(EVENT_VOICE, "MODE long press: voice commands");
    }
  }
}

// Serial Monitor commands, same as the phone's: v1 v2 v3 = vibrate, b<n> = buzz n x 100 ms
void readSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c != '\n' && c != '\r') {
      serialLine += c;
      continue;
    }
    serialLine.trim();
    if (serialLine.length() >= 2) {
      int value = serialLine.substring(1).toInt();
      if (serialLine[0] == 'v') handleCommand(CMD_VIBRATE, value);
      else if (serialLine[0] == 'b') handleCommand(CMD_BUZZ, value);
    }
    serialLine = "";
  }
}

// ─────────────────────────────── main ───────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_MOTOR, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_SOS, INPUT_PULLDOWN);    // the external 10k does the same; this is a backup
  pinMode(PIN_MODE, INPUT_PULLDOWN);
  digitalWrite(PIN_MOTOR, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  Wire.begin(PIN_SDA, PIN_SCL);
  mpuOk = setupMpu();
#if !SIMULATION
  laser.setTimeout(100);
  laserOk = laser.init();
  if (laserOk) {
    laser.setMeasurementTimingBudget(33000);
    laser.startContinuous();
  }
  setupBluetooth();
#endif

  Serial.println();
  Serial.println(SIMULATION ? "GuideAI cane ready (SIMULATION: laser = slider, no Bluetooth)" : "GuideAI cane ready");
  Serial.printf("MPU6050: %s\n", mpuOk ? "ok" : "NOT FOUND (check SDA/SCL)");
#if !SIMULATION
  Serial.printf("VL53L0X: %s\n", laserOk ? "ok" : "NOT FOUND (check SDA/SCL)");
  updateBattery();
#endif
  vibrate(1);
}

void loop() {
  unsigned long now = millis();

  updateButton(sosButton, now);
  updateButton(modeButton, now);

  if (now - lastImu >= IMU_PERIOD_MS) {
    lastImu = now;
    updateFall(now);
  }

  if (now - lastSensor >= SENSOR_PERIOD_MS) {
    lastSensor = now;
    frontCm = readFrontCm();
    groundCm = readGroundCm();
    evaluateHazards();
    sendReadings();
  }

  if (now - lastStatus >= STATUS_PERIOD_MS) {
    lastStatus = now;
    Serial.printf("front %u cm | ground %u cm (normal %.0f) | %s\n", frontCm, groundCm, groundBaseline,
                  LEVEL_NAMES[level]);
  }

#if !SIMULATION
  if (commandPending) {
    handleCommand(pendingCommand[0], pendingCommand[1]);
    commandPending = false;
  }
  if (now - lastBattery >= BATTERY_PERIOD_MS) {
    lastBattery = now;
    updateBattery();
  }
#endif

  readSerialCommands();
  updateFeedback(millis());
}
