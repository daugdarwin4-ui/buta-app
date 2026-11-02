import type { Direction } from '../../constants/hazards';
import type { DetectedHazard } from '../../types/detection.types';

/**
 * What the voice says for a camera detection (explicit class mapping, by the GuideAI model's
 * class names in yolo/yoloLabels.ts):
 *  - stairs, vehicles, people and animals are named: "Careful, stairs ahead.", "Careful, car on your right."
 *  - everything else (chairs, benches, poles, potholes…) is "Careful, obstacle ahead."
 * Direction comes from the existing left / ahead / right mapping. No distance is spoken.
 *
 * Only the spoken words change: boxes, labels and the on-screen alert text keep the model's
 * class names. Cane alerts keep their own messages ("Stop. Drop ahead…").
 */

/** Class → name to say. Classes not listed are said as "obstacle". */
const NAMED: Record<string, string> = {
  // Stairs: a fall hazard, always named when reliably detected
  stairs: 'stairs',
  // Vehicles, parked or moving
  car: 'car',
  motorcycle: 'motorcycle',
  truck: 'truck',
  bus: 'bus',
  bicycle: 'bicycle',
  tricycle: 'tricycle',
  jeepney: 'jeepney',
  // Living things
  person: 'person',
  dog: 'dog',
  cat: 'cat',
  cow: 'cow',
  horse: 'horse',
};

const VEHICLES = new Set(['car', 'motorcycle', 'truck', 'bus', 'bicycle', 'tricycle', 'jeepney']);
const LIVING = new Set(['person', 'dog', 'cat', 'cow', 'horse']);
/** Hazards in the walking path that can make the user fall */
const CRITICAL_PATH = new Set(['stairs', 'pothole', 'open_drainage']);

/**
 * A class is named aloud only when the model is at least this sure. Below it the user is still
 * warned ("obstacle"), but e.g. a floor pattern half-matching stairs is never called "stairs".
 * Detection itself is unchanged (it keeps its own per-class thresholds).
 */
export const NAME_CONFIDENCE = 0.5;

export function isLivingClass(label: string): boolean {
  return LIVING.has(label.toLowerCase());
}

/** Voice priority: 0 stairs and other fall hazards, 1 vehicles, 2 people and animals, 3 other obstacles */
export function voiceRank(label: string): number {
  const l = label.toLowerCase();
  if (CRITICAL_PATH.has(l)) return 0;
  if (VEHICLES.has(l)) return 1;
  if (LIVING.has(l)) return 2;
  return 3;
}

function directionPhrase(direction: Direction): string {
  return direction === 'ahead' ? 'ahead' : `on your ${direction}`;
}

/** Plural names for groups ("two people ahead"); stairs are never counted */
const PLURAL: Record<string, string> = {
  person: 'people', dog: 'dogs', cat: 'cats', cow: 'cows', horse: 'horses',
  car: 'cars', motorcycle: 'motorcycles', truck: 'trucks', bus: 'buses', bicycle: 'bicycles',
  tricycle: 'tricycles', jeepney: 'jeepneys',
};

/**
 * The warning for several objects of the same named kind in the same direction:
 * "Careful, two people ahead.", "Careful, several cars on your left."
 * Falls back to the single-object warning when there is one, or for obstacles and stairs.
 */
export function groupWarning(
  h: Pick<DetectedHazard, 'label' | 'direction' | 'source' | 'announcement' | 'confidence'>,
  count: number
): string {
  const single = spokenWarning(h);
  const plural = PLURAL[h.label.toLowerCase()];
  if (count < 2 || h.source !== 'camera' || !plural || !single.startsWith(`Careful, ${NAMED[h.label.toLowerCase()]} `)) {
    return single;
  }
  const amount = count === 2 ? 'two' : count === 3 ? 'three' : 'several';
  return `Careful, ${amount} ${plural} ${directionPhrase(h.direction)}.`;
}

export function spokenWarning(
  h: Pick<DetectedHazard, 'label' | 'direction' | 'source' | 'announcement' | 'confidence'>
): string {
  if (h.source !== 'camera') return h.announcement;
  const named = h.confidence >= NAME_CONFIDENCE ? NAMED[h.label.toLowerCase()] : undefined;
  return `Careful, ${named ?? 'obstacle'} ${directionPhrase(h.direction)}.`;
}
