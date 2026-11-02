import type { CaneReading, DetectedHazard } from '../../../types/detection.types';
import { CaneHazardDetector } from '../caneHazards';
import type { DetectionSource } from './detectionSource';

const DEMO_INTERVAL_MS = 500;

/**
 * A short walk for demo mode: clear path, wall getting closer, clear, curb, clear, stairs down.
 * Values in cm, as the device would send them (front max 400, ground max 200).
 */
const DEMO_WALK: CaneReading[] = [
  ...Array(4).fill({ frontCm: 400, groundCm: 80 }),
  { frontCm: 250, groundCm: 81 }, { frontCm: 140, groundCm: 79 }, { frontCm: 120, groundCm: 80 },
  { frontCm: 90, groundCm: 80 }, { frontCm: 60, groundCm: 80 }, { frontCm: 55, groundCm: 80 },
  ...Array(4).fill({ frontCm: 400, groundCm: 80 }),
  { frontCm: 400, groundCm: 55 }, { frontCm: 400, groundCm: 56 },
  ...Array(4).fill({ frontCm: 400, groundCm: 80 }),
  { frontCm: 400, groundCm: 130 }, { frontCm: 400, groundCm: 160 }, { frontCm: 400, groundCm: 200 },
  ...Array(4).fill({ frontCm: 400, groundCm: 80 }),
];

/**
 * Cane-device hazards (ESP32 with front ultrasonic + down-angled laser sensor).
 *
 * The Bluetooth link (added when the hardware arrives) calls pushReading() for every packet.
 * Until a device is connected, start() plays DEMO_WALK so the full flow can be tested.
 */
class CaneSource implements DetectionSource {
  readonly id = 'cane' as const;
  readonly spokenName = 'cane device';

  private detector = new CaneHazardDetector();
  private onHazards: ((hazards: DetectedHazard[]) => void) | null = null;
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private deviceConnected = false;

  get isSimulated(): boolean {
    return !this.deviceConnected;
  }

  start(onHazards: (hazards: DetectedHazard[]) => void) {
    this.stop();
    this.onHazards = onHazards;
    this.detector.reset();
    if (!this.deviceConnected) this.startDemo();
  }

  stop() {
    this.stopDemo();
    this.onHazards = null;
  }

  /** Called by the Bluetooth link for each reading from the real device */
  pushReading(reading: CaneReading) {
    this.onHazards?.(this.detector.process(reading));
  }

  /** Called by the Bluetooth link when the device connects or disconnects */
  setDeviceConnected(connected: boolean) {
    this.deviceConnected = connected;
    if (!this.onHazards) return;
    if (connected) {
      this.stopDemo();
      this.detector.reset();
    } else {
      this.onHazards([]);
    }
  }

  private startDemo() {
    let i = 0;
    this.demoTimer = setInterval(() => {
      this.pushReading(DEMO_WALK[i]);
      i = (i + 1) % DEMO_WALK.length;
    }, DEMO_INTERVAL_MS);
  }

  private stopDemo() {
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
  }
}

export const caneSource = new CaneSource();
