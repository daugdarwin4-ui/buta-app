import type { CaneReading, DetectedHazard } from '../../types/detection.types';

/** Tunable thresholds for the cane sensors (centimeters) */
export const CANE_THRESHOLDS = {
  /** Front obstacle this close: stop */
  frontCriticalCm: 70,
  /** Front obstacle this close: warn */
  frontWarningCm: 150,
  /** Typical distance from the down-angled laser to flat ground before it adapts */
  groundDefaultCm: 80,
  /** Ground this much FARTHER than normal = drop (stairs down, canal, hole) */
  dropMarginCm: 25,
  /** Ground this much CLOSER than normal = step up, curb, or low obstacle */
  stepMarginCm: 20,
  /** Only readings this close to the baseline count as "flat ground" for learning it */
  baselineLearnBandCm: 15,
  /** Consecutive drop readings required, so one glitchy sample is not a false alarm */
  dropConfirmReadings: 2,
};

function spokenDistance(cm: number): string {
  if (cm < 100) return 'less than 1 meter';
  const m = Math.round(cm / 50) / 2; // nearest 0.5 m
  return m === 1 ? '1 meter' : `${m} meters`;
}

/**
 * Turns raw cane sensor readings into hazards. Stateful: it learns the normal distance to the
 * ground (it depends on how high the sensor is mounted and how the user holds the cane).
 */
export class CaneHazardDetector {
  private groundBaseline = CANE_THRESHOLDS.groundDefaultCm;
  private dropStreak = 0;

  reset() {
    this.groundBaseline = CANE_THRESHOLDS.groundDefaultCm;
    this.dropStreak = 0;
  }

  get baselineCm(): number {
    return this.groundBaseline;
  }

  process(reading: CaneReading): DetectedHazard[] {
    const t = CANE_THRESHOLDS;
    const hazards: DetectedHazard[] = [];

    // ── Front: obstacles the cane tip cannot reach (branches, signs, truck mirrors) ──
    if (reading.frontCm !== null && reading.frontCm <= t.frontWarningCm) {
      const critical = reading.frontCm <= t.frontCriticalCm;
      hazards.push({
        label: 'obstacle',
        direction: 'ahead',
        distanceEstimate: spokenDistance(reading.frontCm),
        riskLevel: critical ? 'critical' : 'warning',
        announcement: critical
          ? 'Stop. Obstacle ahead at chest height.'
          : `Obstacle ahead at chest height, ${spokenDistance(reading.frontCm)}.`,
        confidence: 1,
        source: 'cane',
      });
    }

    // ── Ground: drops and steps a few steps ahead ──
    if (reading.groundCm !== null) {
      const g = reading.groundCm;
      const isDrop = g >= this.groundBaseline + t.dropMarginCm;
      const isStep = g <= this.groundBaseline - t.stepMarginCm;

      this.dropStreak = isDrop ? this.dropStreak + 1 : 0;

      if (isDrop && this.dropStreak >= t.dropConfirmReadings) {
        hazards.push({
          label: 'drop',
          direction: 'ahead',
          distanceEstimate: null,
          riskLevel: 'critical',
          announcement: 'Stop. Drop ahead. Check with your cane.',
          confidence: 1,
          source: 'cane',
        });
      } else if (isStep) {
        hazards.push({
          label: 'step',
          direction: 'ahead',
          distanceEstimate: null,
          riskLevel: 'warning',
          announcement: 'Step or curb ahead.',
          confidence: 1,
          source: 'cane',
        });
      } else if (Math.abs(g - this.groundBaseline) <= t.baselineLearnBandCm) {
        // Flat ground: slowly adapt to how this user holds the cane
        this.groundBaseline = this.groundBaseline * 0.9 + g * 0.1;
      }
    }

    return hazards;
  }
}
