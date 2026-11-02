import type { DetectedHazard, DetectionSourceId } from '../../../types/detection.types';

/**
 * A provider of hazards (phone camera or cane device). Sources only DETECT; speaking and
 * vibrating is done once, centrally, by hazardAnnouncer so all sources follow the same rules.
 */
export interface DetectionSource {
  readonly id: DetectionSourceId;
  /** Spoken name, e.g. "phone camera" */
  readonly spokenName: string;
  /** True while showing demo data instead of a real camera/device */
  readonly isSimulated: boolean;
  /** Begin emitting. Each call replaces the previous list from this source. */
  start(onHazards: (hazards: DetectedHazard[]) => void): void;
  stop(): void;
}
