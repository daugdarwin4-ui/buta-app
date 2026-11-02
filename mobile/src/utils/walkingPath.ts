import type { RiskLevel } from '../constants/hazards';
import type { BoundingBox } from '../types/detection.types';

/**
 * Decides which detections are worth saying out loud. A blind user walking needs to hear what
 * is in their way or coming at them — not every parked car or person on the far side of the road.
 */

/** Horizontal strip of the frame (0–1) the user is walking into */
export const PATH_LEFT = 0.3;
export const PATH_RIGHT = 0.7;

/** True if the box reaches into the walking strip straight ahead */
export function isInWalkingPath(bbox: BoundingBox): boolean {
  return bbox.x < PATH_RIGHT && bbox.x + bbox.width > PATH_LEFT;
}

interface PathContext {
  riskLevel: RiskLevel;
  inPath: boolean;
  approaching: boolean;
  /** null = too far to estimate */
  meters: number | null;
}

/**
 * Quiet hazards are still shown and included when the user asks "describe what's ahead",
 * but are not announced by themselves.
 */
export function isQuiet({ riskLevel, inPath, approaching, meters }: PathContext): boolean {
  const within = (m: number) => meters !== null && meters <= m;
  if (riskLevel === 'critical') {
    // Vehicles, drops: always spoken unless off to the side, far, and not coming closer
    return !inPath && !approaching && !within(8);
  }
  if (riskLevel === 'warning') {
    // Poles, benches…: only when about to bump into them
    return !((inPath && within(4)) || within(1.5) || (inPath && approaching));
  }
  // People, pets…: only when close in front, or coming at the user
  return !((inPath && within(3)) || (approaching && within(5)));
}

/** Ranking within the same risk level: in the path, coming closer, and near come first */
export function urgencyScore({ inPath, approaching, meters }: Omit<PathContext, 'riskLevel'>): number {
  const nearness = meters === null ? 0 : Math.max(0, 10 - meters);
  return (inPath ? 10 : 0) + (approaching ? 10 : 0) + nearness;
}
