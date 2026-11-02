/**
 * Unit Tests — Detection Utilities
 * Tests: directionMapper, distanceEstimator, detectionThrottle, hazardClassifier
 */
import { mapDirection } from '../src/utils/directionMapper';
import { estimateDistance, estimateDistanceMeters, formatDistance } from '../src/utils/distanceEstimator';
import { DetectionThrottle, detectionThrottle } from '../src/services/detection/detectionThrottle';
import { classifyHazard } from '../src/services/detection/hazardClassifier';
import type { BoundingBox } from '../src/types/detection.types';

// ─── directionMapper ───────────────────────────────────────────────────────────
describe('mapDirection', () => {
  const bboxAt = (centerX: number): BoundingBox => ({
    x: centerX - 0.05,
    y: 0.3,
    width: 0.1,
    height: 0.4,
  });

  it('returns "left" when centerX < 0.33', () => {
    expect(mapDirection(bboxAt(0.1))).toBe('left');
    expect(mapDirection(bboxAt(0.32))).toBe('left');
  });

  it('returns "ahead" when centerX is between 0.33 and 0.67', () => {
    expect(mapDirection(bboxAt(0.5))).toBe('ahead');
    expect(mapDirection(bboxAt(0.33))).toBe('ahead');
    expect(mapDirection(bboxAt(0.67))).toBe('ahead');
  });

  it('returns "right" when centerX > 0.67', () => {
    expect(mapDirection(bboxAt(0.8))).toBe('right');
    expect(mapDirection(bboxAt(0.99))).toBe('right');
  });

  it('handles bbox at left edge (x=0)', () => {
    expect(mapDirection({ x: 0, y: 0, width: 0.1, height: 0.1 })).toBe('left');
  });

  it('handles bbox at right edge (x=0.9)', () => {
    expect(mapDirection({ x: 0.9, y: 0, width: 0.08, height: 0.1 })).toBe('right');
  });
});

// ─── distanceEstimator ────────────────────────────────────────────────────────
describe('estimateDistance', () => {
  it('returns null when object is too far away (height < threshold)', () => {
    const bbox: BoundingBox = { x: 0.4, y: 0.4, width: 0.1, height: 0.01 };
    expect(estimateDistance(bbox, 'person')).toBeNull();
  });

  it('says "very close" when a person fills the whole frame (chest-height camera)', () => {
    const bbox: BoundingBox = { x: 0.0, y: 0.0, width: 1.0, height: 1.0 };
    expect(estimateDistance(bbox, 'person')).toBe('very close');
  });

  it('never speaks an uncalibrated number of meters', () => {
    const bbox: BoundingBox = { x: 0.35, y: 0.2, width: 0.3, height: 0.27 };
    const result = estimateDistance(bbox, 'person');
    expect(result).not.toBeNull();
    expect(result).not.toMatch(/meter|\d/i);
  });

  it('says "near" for a person filling 60% of the frame height (about 2 m)', () => {
    const bbox: BoundingBox = { x: 0.3, y: 0.1, width: 0.4, height: 0.6 };
    expect(estimateDistance(bbox, 'person')).toBe('near');
  });

  it('says "very close" for a low obstacle filling the bottom of the view', () => {
    const bbox: BoundingBox = { x: 0.2, y: 0.3, width: 0.6, height: 0.7 };
    expect(estimateDistance(bbox, 'bench')).toBe('very close');
  });

  it('groups estimates into near / moderate / far bands', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(0.6)).toBe('very close');
    expect(formatDistance(1.49)).toBe('very close');
    expect(formatDistance(1.5)).toBe('near');
    expect(formatDistance(3.4)).toBe('near');
    expect(formatDistance(5)).toBe('moderate distance');
    expect(formatDistance(7)).toBe('far');
    expect(formatDistance(14)).toBe('far');
  });

  it('uses the ground for a tall object whose top is cut off (pole)', () => {
    // Height alone would say ~2.1 m (the box is missing the pole's top); its base says ~1.4 m
    const meters = estimateDistanceMeters({ x: 0.45, y: 0, width: 0.1, height: 0.9 }, 'pole')!;
    expect(meters).toBeLessThan(2);
  });

  it('places ground hazards by where they touch the ground: lower in the image = nearer', () => {
    const near = estimateDistanceMeters({ x: 0.4, y: 0.85, width: 0.2, height: 0.1 }, 'pothole')!;
    const far = estimateDistanceMeters({ x: 0.4, y: 0.55, width: 0.2, height: 0.05 }, 'pothole')!;
    expect(near).toBeLessThan(far);
    // Above the horizon cannot be on the ground
    expect(estimateDistanceMeters({ x: 0.4, y: 0.1, width: 0.2, height: 0.05 }, 'pothole')).toBeNull();
  });

  it('uses default reference height for unknown labels', () => {
    const bbox: BoundingBox = { x: 0.4, y: 0.3, width: 0.2, height: 0.3 };
    const result = estimateDistance(bbox, 'unknown_class');
    expect(result).not.toBeNull();
  });

  it('gives a band for a pothole low in the view', () => {
    const bbox: BoundingBox = { x: 0.4, y: 0.7, width: 0.2, height: 0.1 };
    const meters = estimateDistanceMeters(bbox, 'pothole')!;
    expect(estimateDistance(bbox, 'pothole')).toBe(formatDistance(meters));
    expect(['very close', 'near']).toContain(estimateDistance(bbox, 'pothole'));
  });
});

// ─── DetectionThrottle ───────────────────────────────────────────────────────
describe('DetectionThrottle', () => {
  let throttle: InstanceType<typeof DetectionThrottle>;

  beforeEach(() => {
    throttle = new DetectionThrottle();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows first announcement of any label+direction', () => {
    expect(throttle.shouldAnnounce('person', 'ahead')).toBe(true);
  });

  it('suppresses repeated announcement within throttle window', () => {
    throttle.shouldAnnounce('car', 'left');
    expect(throttle.shouldAnnounce('car', 'left')).toBe(false);
  });

  it('treats different directions as different keys', () => {
    throttle.shouldAnnounce('motorcycle', 'left');
    expect(throttle.shouldAnnounce('motorcycle', 'right')).toBe(true);
  });

  it('treats different labels as different keys', () => {
    throttle.shouldAnnounce('car', 'ahead');
    expect(throttle.shouldAnnounce('truck', 'ahead')).toBe(true);
  });

  it('allows re-announcement after throttle window expires', () => {
    throttle.shouldAnnounce('stairs', 'ahead');
    jest.advanceTimersByTime(6000); // default throttle is 5s
    expect(throttle.shouldAnnounce('stairs', 'ahead')).toBe(true);
  });

  it('reset() clears all throttle state', () => {
    throttle.shouldAnnounce('person', 'ahead');
    throttle.shouldAnnounce('car', 'left');
    throttle.reset();
    expect(throttle.shouldAnnounce('person', 'ahead')).toBe(true);
    expect(throttle.shouldAnnounce('car', 'left')).toBe(true);
  });

  it('reset(label) clears only that label', () => {
    throttle.shouldAnnounce('person', 'ahead');
    throttle.shouldAnnounce('car', 'left');
    throttle.reset('person');
    expect(throttle.shouldAnnounce('person', 'ahead')).toBe(true);
    expect(throttle.shouldAnnounce('car', 'left')).toBe(false);
  });
});

// ─── classifyHazard ──────────────────────────────────────────────────────────
describe('classifyHazard', () => {
  const personDetection = {
    classId: 0,
    label: 'person',
    confidence: 0.92,
    bbox: { x: 0.35, y: 0.15, width: 0.3, height: 0.5 },
  };

  const motorbikeDetection = {
    classId: 3,
    label: 'motorcycle',
    confidence: 0.87,
    bbox: { x: 0.1, y: 0.3, width: 0.2, height: 0.35 },
  };

  const potholeDetection = {
    classId: 91,
    label: 'pothole',
    confidence: 0.75,
    bbox: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
  };

  it('returns a HazardClassificationResult with all required fields', () => {
    const result = classifyHazard(personDetection);
    expect(result).toHaveProperty('direction');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('announcement');
    expect(result).toHaveProperty('arrowIcon');
    expect(result).toHaveProperty('color');
  });

  it('maps person center-bbox to direction "ahead"', () => {
    const result = classifyHazard(personDetection);
    expect(result.direction).toBe('ahead');
  });

  it('maps left-side motorcycle bbox to direction "left"', () => {
    const result = classifyHazard(motorbikeDetection);
    expect(result.direction).toBe('left');
  });

  it('classifies motorcycle as critical risk', () => {
    const result = classifyHazard(motorbikeDetection);
    expect(result.riskLevel).toBe('critical');
  });

  it('classifies pothole as warning or critical risk', () => {
    const result = classifyHazard(potholeDetection);
    expect(['critical', 'warning']).toContain(result.riskLevel);
  });

  it('produces a non-empty announcement string', () => {
    const result = classifyHazard(personDetection);
    expect(result.announcement.length).toBeGreaterThan(0);
  });

  it('uses red color for critical detections', () => {
    const result = classifyHazard(motorbikeDetection);
    expect(result.color).toBe('#EF4444');
  });

  it('uses green color for person (non-critical)', () => {
    const result = classifyHazard(personDetection);
    expect(result.color).toBe('#22C55E');
  });

  it('handles unknown label gracefully without throwing', () => {
    const unknownDetection = {
      classId: 999,
      label: 'unknown_flying_object',
      confidence: 0.6,
      bbox: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    };
    expect(() => classifyHazard(unknownDetection)).not.toThrow();
  });

  it('includes distance estimate in announcement when close enough', () => {
    // Large bbox = close object
    const closeDetection = {
      classId: 0,
      label: 'person',
      confidence: 0.95,
      bbox: { x: 0.3, y: 0.1, width: 0.4, height: 0.5 },
    };
    const result = classifyHazard(closeDetection);
    // Should include distance or direction
    expect(result.announcement).toMatch(/left|right|ahead|meter/i);
  });
});

// ─── Announcement filtering & ordering ─────────────────────────────────────────
import { objectDetectionService } from '../src/services/detection/objectDetection.service';
import { ttsService } from '../src/services/tts/tts.service';

describe('objectDetectionService.processRawDetections', () => {
  const box = (x: number) => ({ x, y: 0.3, width: 0.2, height: 0.4 });

  beforeEach(() => detectionThrottle.reset());

  it('ignores irrelevant objects and low-confidence detections, most dangerous first', () => {
    const { detections } = objectDetectionService.processRawDetections([
      { classId: 41, label: 'cup', confidence: 0.9, bbox: box(0.4) },
      { classId: 0, label: 'person', confidence: 0.9, bbox: box(0.4) },
      { classId: 5, label: 'bus', confidence: 0.7, bbox: box(0.7) },
      { classId: 2, label: 'car', confidence: 0.3, bbox: box(0.4) },
    ]);
    expect(detections.map((d) => d.label)).toEqual(['bus', 'person']);
  });

  it('speaks at most 2 hazards per frame, as one sentence', () => {
    const speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    objectDetectionService.processRawDetections(
      [
        { classId: 5, label: 'bus', confidence: 0.9, bbox: box(0.7) },
        { classId: 2, label: 'car', confidence: 0.9, bbox: box(0.05) },
        { classId: 13, label: 'bench', confidence: 0.9, bbox: box(0.4) },
      ],
      true
    );
    expect(speak).toHaveBeenCalledTimes(1);
    // two hazards joined, the third left out
    expect((speak.mock.calls[0][0] as string).split(' Also ')).toHaveLength(2);
    expect(speak.mock.calls[0][0]).not.toMatch(/bench/i);
    speak.mockRestore();
  });
});
