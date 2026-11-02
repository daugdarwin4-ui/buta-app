/**
 * Hazard class definitions for GuideAI object detection.
 * Maps YOLO class labels → risk levels and concise TTS announcement templates.
 */

export type RiskLevel = 'critical' | 'warning' | 'info';
export type Direction = 'left' | 'ahead' | 'right';

export interface HazardClass {
  label: string;
  displayName: string;
  riskLevel: RiskLevel;
  announcementTemplate: (direction: Direction, distance?: string, approaching?: boolean) => string;
}

/**
 * Formats a natural, non-repetitive phrase: e.g. "Motorcycle on your right, near",
 * or "Approaching motorcycle on your right, near" when it is getting closer.
 */
export function formatAnnouncement(name: string, dir: Direction, dist?: string, approaching = false): string {
  const dirPhrase = dir === 'ahead' ? 'ahead' : `on your ${dir}`;
  const subject = approaching ? `Approaching ${name.toLowerCase()}` : name;
  return dist ? `${subject} ${dirPhrase}, ${dist}` : `${subject} ${dirPhrase}`;
}

export const HAZARD_CLASSES: Record<string, HazardClass> = {
  // ─── Critical hazards ────────────────────────────────────────
  pothole: {
    label: 'pothole',
    displayName: 'Pothole',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Pothole', dir, dist, approaching),
  },
  open_drainage: {
    label: 'open_drainage',
    displayName: 'Open Drain',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Open drain', dir, dist, approaching),
  },
  stairs: {
    label: 'stairs',
    displayName: 'Stairs',
    riskLevel: 'critical',
    // A fall risk: opens with "Caution" so it stands out from the other alerts. Up or down is not
    // said, because the model cannot yet tell them apart reliably.
    announcementTemplate: (dir, dist, approaching) => {
      const phrase = formatAnnouncement('stairs', dir, dist, approaching);
      // "Caution, approaching stairs ahead", not "Caution, Approaching ..."
      return `Caution, ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
    },
  },
  vehicle: {
    label: 'vehicle',
    displayName: 'Vehicle',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Vehicle', dir, dist, approaching),
  },
  motorcycle: {
    label: 'motorcycle',
    displayName: 'Motorcycle',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Motorcycle', dir, dist, approaching),
  },
  car: {
    label: 'car',
    displayName: 'Car',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Car', dir, dist, approaching),
  },
  truck: {
    label: 'truck',
    displayName: 'Truck',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Truck', dir, dist, approaching),
  },
  bus: {
    label: 'bus',
    displayName: 'Bus',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Bus', dir, dist, approaching),
  },
  jeepney: {
    label: 'jeepney',
    displayName: 'Jeepney',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Jeepney', dir, dist, approaching),
  },
  tricycle: {
    // Custom class (needs the fine-tuned model, see model/EXPORT_FOR_APP.md)
    label: 'tricycle',
    displayName: 'Tricycle',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Tricycle', dir, dist, approaching),
  },
  construction: {
    label: 'construction',
    displayName: 'Construction',
    riskLevel: 'critical',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Construction obstacle', dir, dist, approaching),
  },

  // ─── Warnings ─────────────────────────────────────────────────
  pole: {
    label: 'pole',
    displayName: 'Pole',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Pole', dir, dist, approaching),
  },
  barrier: {
    label: 'barrier',
    displayName: 'Barrier',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Barrier', dir, dist, approaching),
  },
  low_hanging: {
    label: 'low_hanging',
    displayName: 'Low Obstacle',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist) =>
      dist ? `Low obstacle ahead, watch your head, ${dist}` : `Low obstacle ahead, watch your head`,
  },
  bump: {
    // Speed bump / raised edge: a trip hazard on the ground
    label: 'bump',
    displayName: 'Bump',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Bump', dir, dist, approaching),
  },
  cart: {
    // Vendor carts and stalls blocking the sidewalk
    label: 'cart',
    displayName: 'Cart',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Cart', dir, dist, approaching),
  },
  bicycle: {
    label: 'bicycle',
    displayName: 'Bicycle',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Bicycle', dir, dist, approaching),
  },
  // Sidewalk obstacles the ready-made (COCO) model can already see — labels must match exactly
  bench: {
    label: 'bench',
    displayName: 'Bench',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Bench', dir, dist, approaching),
  },
  chair: {
    label: 'chair',
    displayName: 'Chair',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Chair', dir, dist, approaching),
  },
  'fire hydrant': {
    label: 'fire hydrant',
    displayName: 'Fire Hydrant',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Fire hydrant', dir, dist, approaching),
  },
  'parking meter': {
    label: 'parking meter',
    displayName: 'Post',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Post', dir, dist, approaching),
  },
  'potted plant': {
    label: 'potted plant',
    displayName: 'Plant Pot',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Plant pot', dir, dist, approaching),
  },
  cow: {
    label: 'cow',
    displayName: 'Large Animal',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Large animal', dir, dist, approaching),
  },
  horse: {
    label: 'horse',
    displayName: 'Horse',
    riskLevel: 'warning',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Horse', dir, dist, approaching),
  },

  // ─── Informational ────────────────────────────────────────────
  person: {
    label: 'person',
    displayName: 'Person',
    riskLevel: 'info',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Person', dir, dist, approaching),
  },
  dog: {
    label: 'dog',
    displayName: 'Dog',
    riskLevel: 'info',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Dog', dir, dist, approaching),
  },
  cat: {
    label: 'cat',
    displayName: 'Cat',
    riskLevel: 'info',
    announcementTemplate: (dir, dist, approaching) => formatAnnouncement('Cat', dir, dist, approaching),
  },
  'traffic light': {
    label: 'traffic light',
    displayName: 'Traffic Light',
    riskLevel: 'info',
    announcementTemplate: (dir) => formatAnnouncement('Traffic light', dir),
  },
  'stop sign': {
    label: 'stop sign',
    displayName: 'Stop Sign',
    riskLevel: 'info',
    announcementTemplate: (dir) => formatAnnouncement('Stop sign', dir),
  },
};

/**
 * Only labels listed above are spoken. The ready-made model also reports 60+ indoor or
 * irrelevant objects (cup, laptop, tv…); announcing those would bury the real hazards.
 */
export function isAnnouncedHazard(label: string): boolean {
  return label.toLowerCase() in HAZARD_CLASSES;
}

/** At most this many announcements per frame, most dangerous first, so speech never lags reality */
export const MAX_ANNOUNCEMENTS_PER_FRAME = 2;

/** Default minimum confidence for a detection to count (classes below can override it) */
export const DETECTION_CONFIDENCE_THRESHOLD = 0.45;

/**
 * Per-class minimum confidence. Lower = catch more (at the cost of false alarms, which the
 * multi-frame confirmation filters out); higher = only when sure.
 *  - Dangerous drops and vehicles: lower, missing one is worse than a false alarm.
 *  - People, pets, furniture: higher, the ready-made model often guesses these wrongly.
 */
export const CLASS_CONFIDENCE_THRESHOLDS: Record<string, number> = {
  // The GuideAI model finds these reliably when sure, but misses many (test recall 33–42%):
  // a lower bar catches more, and the multi-frame confirmation removes one-off false alarms.
  pothole: 0.3,
  open_drainage: 0.3,
  // Model v2 on the test set: 0.40 still finds most stairs, with fewer false "stairs" on striped
  // surfaces; the tracker also needs stairs in 3 of 4 frames (hazardTracker.ts)
  stairs: 0.4,
  barrier: 0.35,
  bump: 0.35,
  jeepney: 0.4,
  cart: 0.45,
  vehicle: 0.4,
  car: 0.4,
  truck: 0.4,
  bus: 0.4,
  motorcycle: 0.4,
  tricycle: 0.4,
  bicycle: 0.4,
  person: 0.5,
  dog: 0.5,
  cat: 0.5,
  bench: 0.5,
  chair: 0.5,
  'potted plant': 0.5,
};

export function confidenceThresholdFor(label: string): number {
  return CLASS_CONFIDENCE_THRESHOLDS[label.toLowerCase()] ?? DETECTION_CONFIDENCE_THRESHOLD;
}

/** Lowest threshold of any class: the model output is first cut at this, then per class */
export const MIN_CONFIDENCE_THRESHOLD = Math.min(
  DETECTION_CONFIDENCE_THRESHOLD,
  ...Object.values(CLASS_CONFIDENCE_THRESHOLDS)
);

/** Hazards that can move toward the user: getting closer makes them more dangerous */
export const MOVING_HAZARDS = new Set([
  'person', 'dog', 'cat', 'cow', 'horse', 'bicycle',
  'motorcycle', 'car', 'truck', 'bus', 'vehicle', 'tricycle', 'jeepney',
]);

/** Throttle: minimum seconds between same class + direction announcements */
export const DETECTION_THROTTLE_SECONDS = 5;

/** Frame processing interval in milliseconds (lower = more frequent) */
export const DETECTION_FRAME_INTERVAL_MS = 300;
