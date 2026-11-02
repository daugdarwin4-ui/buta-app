import type { BoundingBox } from '../types/detection.types';
import type { Direction } from '../constants/hazards';

/**
 * Maps a bounding box x-center position to a direction label.
 * Frame is divided into three zones: left (0-33%), center (33-67%), right (67-100%).
 */
export function mapDirection(bbox: BoundingBox): Direction {
  const centerX = bbox.x + bbox.width / 2;

  if (centerX < 0.33) return 'left';
  if (centerX > 0.67) return 'right';
  return 'ahead';
}
