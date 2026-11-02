import { HAZARD_CLASSES, HazardClass, RiskLevel, Direction, MOVING_HAZARDS, formatAnnouncement } from '../../constants/hazards';
import type { RawDetection, ClassifiedDetection } from '../../types/detection.types';
import { mapDirection } from '../../utils/directionMapper';
import { estimateDistanceMeters, formatDistance } from '../../utils/distanceEstimator';
import { isInWalkingPath, isQuiet, urgencyScore } from '../../utils/walkingPath';

export interface HazardClassificationResult extends ClassifiedDetection {
  arrowIcon: '↑' | '↗' | '↖' | '→' | '←';
  color: string;
}

export interface ClassifyOptions {
  /** The object got bigger over the last second (from the frame-to-frame tracker) */
  approaching?: boolean;
}

/** A moving hazard coming at the user is one step more dangerous */
const ESCALATE: Record<RiskLevel, RiskLevel> = { info: 'warning', warning: 'critical', critical: 'critical' };

export function classifyHazard(raw: RawDetection, { approaching = false }: ClassifyOptions = {}): HazardClassificationResult {
  const label = raw.label.toLowerCase();
  const direction: Direction = mapDirection(raw.bbox);
  const distanceMeters = estimateDistanceMeters(raw.bbox, label);
  const distanceEstimate = formatDistance(distanceMeters);
  const inPath = isInWalkingPath(raw.bbox);

  const hazardMeta: HazardClass = HAZARD_CLASSES[label] || {
    label: raw.label,
    displayName: raw.label.charAt(0).toUpperCase() + raw.label.slice(1),
    riskLevel: 'info' as RiskLevel,
    announcementTemplate: (dir: Direction, dist?: string, isApproaching?: boolean) =>
      formatAnnouncement(raw.label, dir, dist, isApproaching),
  };

  const riskLevel: RiskLevel =
    approaching && MOVING_HAZARDS.has(label) ? ESCALATE[hazardMeta.riskLevel] : hazardMeta.riskLevel;

  // Generate clean, natural announcement
  const announcement = hazardMeta.announcementTemplate(direction, distanceEstimate ?? undefined, approaching);

  const quiet = isQuiet({ riskLevel, inPath, approaching, meters: distanceMeters });
  const urgency = urgencyScore({ inPath, approaching, meters: distanceMeters });

  // Directional arrow for visual HUD / TalkBack
  let arrowIcon: '↑' | '↗' | '↖' | '→' | '←' = '↑';
  if (direction === 'left') arrowIcon = '↖';
  else if (direction === 'right') arrowIcon = '↗';

  // UI color based on risk and class (green for safe/person, red/orange for critical/warning)
  let color = '#22C55E'; // green safe default
  if (riskLevel === 'critical') {
    color = '#EF4444'; // Red
  } else if (riskLevel === 'warning') {
    color = '#F97316'; // Orange
  } else if (label === 'person') {
    color = '#22C55E'; // Green as in mockup
  }

  return {
    ...raw,
    direction,
    distanceEstimate,
    distanceMeters,
    riskLevel,
    announcement,
    inPath,
    approaching,
    quiet,
    urgency,
    arrowIcon,
    color,
  };
}
