import type { RiskLevel, Direction } from '../constants/hazards';

export interface BoundingBox {
  x: number;       // top-left x (normalized 0-1)
  y: number;       // top-left y (normalized 0-1)
  width: number;   // normalized width
  height: number;  // normalized height
}

export interface RawDetection {
  classId: number;
  label: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface ClassifiedDetection extends RawDetection {
  direction: Direction;
  distanceEstimate: string | null;   // e.g. "1.5 meters"
  distanceMeters: number | null;
  riskLevel: RiskLevel;
  announcement: string;              // e.g. "Person ahead, approximately 2 meters"
  /** Overlaps the strip straight ahead where the user is walking */
  inPath: boolean;
  approaching: boolean;
  quiet: boolean;
  urgency: number;
}

export interface DetectionFrame {
  timestamp: number;
  detections: ClassifiedDetection[];
}

// ─── Detection sources ────────────────────────────────────────────────────────

/** Where hazard detections come from */
export type DetectionSourceId = 'camera' | 'cane';

/** User setting: which source(s) to use, depending on whether they carry the cane device */
export type DetectionSourceSetting = 'camera' | 'cane' | 'both';

/**
 * One reading from the cane device (format defined in hardware/PROTOCOL.md).
 * Distances in centimeters. null = no valid reading (sensor error), which is ignored.
 * When nothing is within range the device sends its maximum (front 400, ground 200), so an
 * out-of-range ground reading correctly reads as a drop.
 */
export interface CaneReading {
  /** Ultrasonic sensor facing forward at chest/head height */
  frontCm: number | null;
  /** Laser (ToF) sensor angled down at the ground ahead of the cane tip */
  groundCm: number | null;
}

/**
 * A hazard ready to show and announce, from either source.
 * Camera detections (HazardClassificationResult) already have this shape.
 */
export interface DetectedHazard {
  label: string;
  direction: Direction;
  distanceEstimate: string | null;
  riskLevel: RiskLevel;
  announcement: string;
  confidence: number;
  color?: string;
  source: DetectionSourceId;
  /** Where the camera saw it (0–1 of the camera frame); absent for cane hazards */
  bbox?: BoundingBox;
  /** Same number for the same object across camera frames (HazardTracker) */
  trackId?: number;
  /** Getting closer over the last second (camera tracking) */
  approaching?: boolean;
  /** Shown and included in "describe", but not announced on its own (off the walking path / far) */
  quiet?: boolean;
  /** Higher = more pressing within the same risk level (in the walking path, near, approaching) */
  urgency?: number;
}
