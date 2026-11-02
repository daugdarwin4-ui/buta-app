import { MAX_ANNOUNCEMENTS_PER_FRAME } from '../../constants/hazards';
import type { DetectedHazard } from '../../types/detection.types';
import { detectionThrottle } from './detectionThrottle';
import { groupWarning, spokenWarning, voiceRank } from './spokenWarning';

/** An alert of ours longer ago than this is no longer what the voice is saying */
const OWN_ALERT_MS = 6000;

/** Voice priority of a hazard; cane drops and close obstacles count as fall hazards */
export function rankOf(h: DetectedHazard): number {
  if (h.source !== 'camera') return h.riskLevel === 'critical' ? 0 : 3;
  return voiceRank(h.label);
}
import { PROXIMITY } from '../../utils/distanceEstimator';
import { ttsService } from '../tts/tts.service';
import { hapticsService } from '../haptics/haptics.service';

const PRIORITY = { critical: 0, warning: 1, info: 2 } as const;

/** Most dangerous first, then most urgent (in the path, near, approaching), then most confident */
export function sortByDanger<T extends Pick<DetectedHazard, 'riskLevel' | 'confidence' | 'urgency'>>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pDiff = PRIORITY[a.riskLevel] - PRIORITY[b.riskLevel];
    if (pDiff !== 0) return pDiff;
    const uDiff = (b.urgency ?? 0) - (a.urgency ?? 0);
    return uDiff !== 0 ? uDiff : b.confidence - a.confidence;
  });
}

/** Critical and either coming closer or within arm's reach: worth cutting into another alert */
export function isUrgentNow(h: DetectedHazard): boolean {
  if (h.riskLevel !== 'critical') return false;
  // Camera hazards give a proximity band; the cane sensor measures real meters
  return (
    !!h.approaching ||
    h.distanceEstimate === PROXIMITY.veryClose ||
    h.distanceEstimate === 'less than 1 meter' ||
    h.distanceEstimate === '1 meter'
  );
}

/**
 * "Car ahead, near." → "car ahead"; "Careful, obstacle on your left." → "obstacle on your left"
 * (the second item in a sentence is kept short)
 */
function shortForm(announcement: string): string {
  const text = announcement
    .replace(/\.$/, '')
    .replace(/^careful,\s*/i, '')
    .replace(/,\s*((less than )?[\d.]+ meters?|very close|near|moderate distance|far)$/i, '');
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** One sentence for everything announced in this update, most dangerous first */
export function combineAnnouncements(announcements: string[]): string {
  const [first, ...rest] = announcements.map((a) => a.replace(/\.$/, ''));
  if (!first) return '';
  return rest.length === 0 ? `${first}.` : `${first}. Also ${rest.map(shortForm).join(', and ')}.`;
}

/** Same hazard, same place: used to avoid an alert interrupting itself */
function keyOf(h: DetectedHazard): string {
  return `${h.label}:${h.riskLevel}${h.approaching ? ':approaching' : ''}:${h.direction}`;
}

/**
 * Single place that turns hazards into speech and vibration, whichever source found them
 * (phone camera, cane device, or both), so every source follows the same rules:
 *  - most dangerous first, at most MAX_ANNOUNCEMENTS_PER_FRAME per update, spoken as ONE sentence
 *  - an alert that is being spoken is allowed to finish. Alerts used to interrupt each other
 *    (several vehicles in view meant no sentence was ever completed). A new alert now waits —
 *    it is not marked as announced, so it is spoken as soon as the voice is free — unless it is
 *    more important than what is being said, or urgent (approaching, or within about a meter)
 *  - vibration is immediate even when the spoken alert has to wait
 *  - the same hazard in the same direction is not repeated within the throttle window,
 *    unless it got MORE dangerous or started approaching (both are part of the throttle key)
 *  - quiet hazards (off the walking path, far away) are shown but not spoken
 */
class HazardAnnouncer {
  /** Hazards in the alert being spoken, so the same alert never interrupts itself */
  private speakingKeys = new Set<string>();
  /** Last hazard vibrated for while the voice was busy, to avoid buzzing on every frame */
  private lastWaitingBuzz = '';
  /** Voice rank and speech priority of the last alert spoken, and when (to let a higher-ranked hazard cut in) */
  private spokenRank = Number.MAX_SAFE_INTEGER;
  private spokenPriority: number | null = null;
  private spokenAt = 0;

  announce(hazards: DetectedHazard[]): void {
    // Voice priority first (stairs/fall hazards, vehicles, people/animals, other obstacles),
    // then the existing danger order within each group
    const candidates = sortByDanger(hazards)
      .filter((h) => !h.quiet)
      .sort((a, b) => rankOf(a) - rankOf(b));
    if (candidates.length === 0) return;
    const top = candidates[0];

    // Let the current message finish, unless this one matters more
    const speaking = ttsService.speakingPriority;
    let higherRank = false;
    if (speaking !== null) {
      // Our own alert is being spoken: the voice priority list decides (a chair does not cut off
      // "person"); other speech (e.g. a navigation step) yields to more serious hazards as before
      const ours = speaking === this.spokenPriority && Date.now() - this.spokenAt < OWN_ALERT_MS;
      const moreImportant = !ours && PRIORITY[top.riskLevel] < speaking;
      const urgent = isUrgentNow(top) && !this.speakingKeys.has(keyOf(top));
      higherRank = ours && rankOf(top) < this.spokenRank;
      if (!moreImportant && !urgent && !higherRank) {
        this.buzzWhileWaiting(top);
        return;
      }
    }

    // How many objects share each warning, so two people ahead are "two people ahead"
    const counts = new Map<string, number>();
    for (const h of candidates) counts.set(spokenWarning(h), (counts.get(spokenWarning(h)) ?? 0) + 1);

    const chosen: DetectedHazard[] = [];
    const phrases: string[] = [];
    for (const h of candidates) {
      if (chosen.length >= MAX_ANNOUNCEMENTS_PER_FRAME) break;
      const phrase = groupWarning(h, counts.get(spokenWarning(h)) ?? 1);
      // Two chairs ahead are one "Careful, obstacle ahead."
      if (phrases.includes(phrase)) continue;
      // Throttled by what the user hears, so a chair then a table ahead is not said twice in a
      // row; said again sooner if it became more dangerous (riskier, approaching, very close)
      const throttleKey = `${phrase}:${h.riskLevel}${h.approaching ? ':approaching' : ''}${isUrgentNow(h) ? ':urgent' : ''}`;
      if (detectionThrottle.shouldAnnounce(throttleKey, h.direction)) {
        chosen.push(h);
        phrases.push(phrase);
      }
    }
    if (chosen.length === 0) return;

    this.speakingKeys = new Set(chosen.map(keyOf));
    this.lastWaitingBuzz = '';
    const risk = chosen[0].riskLevel;
    const sentence = combineAnnouncements(phrases);
    // A higher-priority hazard replaces the alert being spoken (critical speech always does)
    if (higherRank && risk !== 'critical') ttsService.speakImmediate(sentence, risk);
    else ttsService.speak(sentence, risk);
    this.spokenRank = rankOf(chosen[0]);
    this.spokenPriority = PRIORITY[risk];
    this.spokenAt = Date.now();
    hapticsService.triggerForRisk(risk);
  }

  /** A critical hazard whose spoken alert has to wait is still signalled by touch, once */
  private buzzWhileWaiting(top: DetectedHazard) {
    const key = keyOf(top);
    if (top.riskLevel !== 'critical' || this.lastWaitingBuzz === key || this.speakingKeys.has(key)) return;
    this.lastWaitingBuzz = key;
    hapticsService.triggerForRisk(top.riskLevel);
  }

  /** Forget what was being spoken (tests, or after speech was stopped) */
  reset() {
    this.spokenRank = Number.MAX_SAFE_INTEGER;
    this.spokenPriority = null;
    this.spokenAt = 0;
    this.speakingKeys.clear();
    this.lastWaitingBuzz = '';
  }
}

export const hazardAnnouncer = new HazardAnnouncer();
