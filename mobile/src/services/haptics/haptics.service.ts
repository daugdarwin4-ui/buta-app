import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { RiskLevel } from '../../constants/hazards';

/**
 * Haptics Service — vibration patterns per risk level.
 * Provides non-visual feedback for visually impaired users.
 * Gracefully no-ops or uses navigator.vibrate on web.
 */
export type HapticIntensity = 'low' | 'medium' | 'high';

type Style = Haptics.ImpactFeedbackStyle;
const { Light, Medium, Heavy } = Haptics.ImpactFeedbackStyle;

/**
 * Pulse patterns per intensity setting and risk level. "Low" is gentler, never off:
 * for a blind user vibration is a primary warning channel.
 */
const PATTERNS: Record<HapticIntensity, Record<RiskLevel, Style[]>> = {
  low:    { critical: [Medium, Medium],              warning: [Light, Light],   info: [Light] },
  medium: { critical: [Heavy, Heavy, Heavy],         warning: [Medium, Medium], info: [Light] },
  high:   { critical: [Heavy, Heavy, Heavy, Heavy],  warning: [Heavy, Heavy],   info: [Medium] },
};

class HapticsService {
  private intensity: HapticIntensity = 'medium';

  setIntensity(intensity: HapticIntensity) {
    this.intensity = intensity;
  }

  /** Trigger haptic pattern based on detection risk level */
  async triggerForRisk(riskLevel: RiskLevel) {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (riskLevel === 'critical') navigator.vibrate([200, 100, 200, 100, 200]);
        else if (riskLevel === 'warning') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(50);
      }
      return;
    }

    try {
      const pulses = PATTERNS[this.intensity][riskLevel];
      for (let i = 0; i < pulses.length; i++) {
        if (i > 0) await this._delay(riskLevel === 'critical' ? 120 : 150);
        await Haptics.impactAsync(pulses[i]);
      }
    } catch {
      // Haptics unavailable on this platform
    }
  }

  /** Button press feedback */
  async buttonPress() {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
      return;
    }
    try {
      await Haptics.selectionAsync();
    } catch {
      // Ignored
    }
  }

  /** SOS confirmation — long strong vibration */
  async sosConfirmation() {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([300, 150, 300]);
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await this._delay(200);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignored
    }
  }

  /** Success feedback */
  async success() {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 100]);
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignored
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const hapticsService = new HapticsService();
