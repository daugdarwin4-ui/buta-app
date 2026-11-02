import { DETECTION_THROTTLE_SECONDS } from '../../constants/hazards';
import type { Direction } from '../../constants/hazards';

type ThrottleKey = string;  // `${label}_${direction}`

/**
 * Detection Throttle — suppresses repeated announcements of the same
 * class in the same direction within the throttle window.
 * Prevents audio spam when an obstacle stays in view for multiple frames.
 */
export class DetectionThrottle {
  private lastAnnounced: Map<ThrottleKey, number> = new Map();

  /**
   * Returns true if this detection should be announced.
   * Returns false if it was recently announced (within throttle window).
   */
  shouldAnnounce(label: string, direction: Direction): boolean {
    const key: ThrottleKey = `${label}_${direction}`;
    const now = Date.now();
    const lastTime = this.lastAnnounced.get(key);

    if (lastTime === undefined || now - lastTime > DETECTION_THROTTLE_SECONDS * 1000) {
      this.lastAnnounced.set(key, now);
      return true;
    }

    return false;
  }

  /** Force-reset throttle for a specific class (e.g. after scene change) */
  reset(label?: string) {
    if (label) {
      for (const key of this.lastAnnounced.keys()) {
        if (key.startsWith(label)) this.lastAnnounced.delete(key);
      }
    } else {
      this.lastAnnounced.clear();
    }
  }
}

export const detectionThrottle = new DetectionThrottle();
