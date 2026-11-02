import type { Direction } from '../../constants/hazards';
import type { DetectedHazard } from '../../types/detection.types';

/**
 * What the voice says for a camera detection:
 *  - living things the model can recognise are named: "Careful, person ahead."
 *  - everything else is "Careful, obstacle ahead." (no object names such as "stairs" or "chair")
 * Direction comes from the existing left / ahead / right mapping. No distance is spoken.
 *
 * Only the spoken words change: boxes, labels and the on-screen alert text keep the model's
 * class names. Cane alerts keep their own messages ("Stop. Drop ahead…").
 */

/** Living classes in the GuideAI model, with the name to say */
const LIVING_NAMES: Record<string, string> = {
  person: 'person',
  dog: 'dog',
  cat: 'cat',
  cow: 'cow',
  horse: 'horse',
};

export function isLivingClass(label: string): boolean {
  return label.toLowerCase() in LIVING_NAMES;
}

function directionPhrase(direction: Direction): string {
  return direction === 'ahead' ? 'ahead' : `on your ${direction}`;
}

export function spokenWarning(h: Pick<DetectedHazard, 'label' | 'direction' | 'source' | 'announcement'>): string {
  if (h.source !== 'camera') return h.announcement;
  const name = LIVING_NAMES[h.label.toLowerCase()] ?? 'obstacle';
  return `Careful, ${name} ${directionPhrase(h.direction)}.`;
}
