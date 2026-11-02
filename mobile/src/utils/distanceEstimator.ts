import type { BoundingBox } from '../types/detection.types';
import { CAMERA_HEIGHT_M, CAMERA_PITCH_DEG, CAMERA_VERTICAL_FOV_DEG } from '../constants/camera';

/**
 * Estimates how far a detected object is from the camera, from its bounding box
 * (normalized 0–1 coordinates of the full camera frame).
 *
 * Two methods, both from basic camera geometry (constants/camera.ts):
 *  - Upright objects (people, vehicles, poles…): distance = real height × focal length / box height.
 *  - Flat ground hazards (potholes, drains): their box height says little, so we use where the
 *    box's bottom edge meets the ground: the lower in the image, the nearer.
 * These are rough estimates — used internally for risk, and spoken only as proximity bands.
 */

/** Typical real-world heights in meters */
const REAL_HEIGHTS_M: Record<string, number> = {
  person: 1.6,
  car: 1.5,
  vehicle: 1.6,
  truck: 3.0,
  bus: 3.0,
  motorcycle: 1.1,
  tricycle: 1.6,
  jeepney: 2.4,
  cart: 1.2,
  bicycle: 1.0,
  pole: 2.5,
  barrier: 1.0,
  construction: 1.0,
  low_hanging: 0.5,
  bench: 0.8,
  chair: 0.9,
  'fire hydrant': 0.7,
  'parking meter': 1.3,
  'potted plant': 0.6,
  cow: 1.4,
  horse: 1.6,
  dog: 0.5,
  cat: 0.25,
  'stop sign': 0.75,
  default: 1.0,
};

/** Hazards that lie on the ground, measured by where they touch it */
const GROUND_HAZARDS = new Set(['pothole', 'open_drainage', 'stairs', 'bump']);

/** Beyond this the estimate is too rough to be useful (and the object too far to matter) */
const MAX_DISTANCE_M = 15;

/** A box edge this close to the frame border is treated as cut off by the frame */
const EDGE = 0.01;

const deg = Math.PI / 180;
const halfFovTan = Math.tan((CAMERA_VERTICAL_FOV_DEG / 2) * deg);
/** Focal length in units of frame height */
const FOCAL = 1 / (2 * halfFovTan);

/** Distance along the ground to the point seen at image height y (0 = top, 1 = bottom), or null above the horizon */
function groundDistanceAt(y: number): number | null {
  const belowAxis = Math.atan((y - 0.5) * 2 * halfFovTan);
  const depression = CAMERA_PITCH_DEG * deg + belowAxis;
  if (depression <= 1 * deg) return null;
  return CAMERA_HEIGHT_M / Math.tan(depression);
}

/** Estimated distance in meters, or null if too far / not measurable */
export function estimateDistanceMeters(bbox: BoundingBox, label: string): number | null {
  const bottom = bbox.y + bbox.height;
  const bottomCut = bottom >= 1 - EDGE;
  const topCut = bbox.y <= EDGE;

  let meters: number | null;
  if (GROUND_HAZARDS.has(label)) {
    // Use the far edge of the box when the near edge runs off the frame: it's at least that close
    meters = groundDistanceAt(bottomCut ? bbox.y : bottom);
  } else if (bbox.height <= 0) {
    meters = null;
  } else {
    const realHeight = REAL_HEIGHTS_M[label] ?? REAL_HEIGHTS_M.default;
    meters = (realHeight * FOCAL) / bbox.height;
    if (topCut && !bottomCut) {
      // Top cut off (tall pole, person very close): the box is too short, so measure from the ground
      const ground = groundDistanceAt(bottom);
      if (ground !== null) meters = Math.min(meters, ground);
    } else if (bottomCut && !topCut) {
      // Base is below the frame, i.e. nearer than the lowest ground point the camera can see
      const nearest = groundDistanceAt(1);
      if (nearest !== null) meters = Math.min(meters, nearest);
    }
  }

  if (meters === null || meters > MAX_DISTANCE_M) return null;
  return meters;
}

/**
 * Spoken proximity bands. The meter estimate above comes from typical object sizes and an assumed
 * phone height/tilt, not from a calibrated depth sensor, so the user is told how near, never a
 * number of meters that would sound more exact than it is.
 */
export const PROXIMITY = {
  veryClose: 'very close',
  near: 'near',
  moderate: 'moderate distance',
  far: 'far',
} as const;
export type Proximity = (typeof PROXIMITY)[keyof typeof PROXIMITY];

/** Upper bounds (meters) of each band; anything beyond the last is "far" */
const VERY_CLOSE_M = 1.5;
const NEAR_M = 3.5;
const MODERATE_M = 7;

/** Spoken form: "very close", "near", "moderate distance", "far"; null when unknown */
export function formatDistance(meters: number | null): Proximity | null {
  if (meters === null) return null;
  if (meters < VERY_CLOSE_M) return PROXIMITY.veryClose;
  if (meters < NEAR_M) return PROXIMITY.near;
  if (meters < MODERATE_M) return PROXIMITY.moderate;
  return PROXIMITY.far;
}

/** Proximity band for a detection box, or null if it can't be estimated */
export function estimateDistance(bbox: BoundingBox, label: string): string | null {
  return formatDistance(estimateDistanceMeters(bbox, label));
}
