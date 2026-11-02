/**
 * Unit Tests — smarter camera detection: frame-to-frame tracking, walking-path relevance,
 * per-class thresholds, approaching hazards
 */
import { HazardTracker } from '../src/services/detection/hazardTracker';
import { classifyHazard } from '../src/services/detection/hazardClassifier';
import { hazardAnnouncer, sortByDanger } from '../src/services/detection/hazardAnnouncer';
import { detectionThrottle } from '../src/services/detection/detectionThrottle';
import { objectDetectionService } from '../src/services/detection/objectDetection.service';
import { isInWalkingPath, isQuiet } from '../src/utils/walkingPath';
import { confidenceThresholdFor, MIN_CONFIDENCE_THRESHOLD } from '../src/constants/hazards';
import { ttsService } from '../src/services/tts/tts.service';
import type { DetectedHazard, RawDetection } from '../src/types/detection.types';

const det = (label: string, confidence: number, x = 0.4, height = 0.3, y = 0.3): RawDetection => ({
  classId: 0,
  label,
  confidence,
  bbox: { x, y, width: 0.2, height },
});

describe('HazardTracker', () => {
  let tracker: HazardTracker;
  beforeEach(() => (tracker = new HazardTracker()));

  it('waits for a second sighting before reporting an uncertain object', () => {
    expect(tracker.update([det('car', 0.5)], 0)).toHaveLength(0);
    expect(tracker.update([det('car', 0.5, 0.42)], 350)).toHaveLength(1);
  });

  it('reports a very confident object immediately', () => {
    expect(tracker.update([det('bus', 0.9)], 0)).toHaveLength(1);
  });

  it('ignores a one-frame false alarm', () => {
    tracker.update([det('dog', 0.55)], 0);
    expect(tracker.update([], 350)).toHaveLength(0);
    expect(tracker.update([], 700)).toHaveLength(0);
  });

  it('keeps a confirmed object through one missed frame, then drops it', () => {
    tracker.update([det('car', 0.9)], 0);
    expect(tracker.update([], 350)).toHaveLength(1);
    expect(tracker.update([], 700)).toHaveLength(0);
  });

  it('keeps the same identity as the object moves', () => {
    const [a] = tracker.update([det('car', 0.9, 0.4)], 0);
    const [b] = tracker.update([det('car', 0.9, 0.48)], 350);
    expect(b.trackId).toBe(a.trackId);
  });

  it('does not mix up different kinds of objects', () => {
    tracker.update([det('car', 0.9)], 0);
    const out = tracker.update([det('person', 0.9)], 350);
    expect(out.find((t) => t.label === 'person')!.trackId).not.toBe(out.find((t) => t.label === 'car')!.trackId);
  });

  it('flags an object whose box grows over a second as approaching', () => {
    let out = tracker.update([det('motorcycle', 0.9, 0.4, 0.2)], 0);
    out = tracker.update([det('motorcycle', 0.9, 0.4, 0.22)], 350);
    expect(out[0].approaching).toBe(false); // not enough time yet
    out = tracker.update([det('motorcycle', 0.9, 0.4, 0.25)], 700);
    out = tracker.update([det('motorcycle', 0.9, 0.4, 0.28)], 1050);
    expect(out[0].approaching).toBe(true);
  });

  it('does not flag a still object as approaching', () => {
    let out: ReturnType<HazardTracker['update']> = [];
    for (let t = 0; t <= 1400; t += 350) out = tracker.update([det('car', 0.9, 0.4, 0.3)], t);
    expect(out[0].approaching).toBe(false);
  });
});

describe('walking path relevance', () => {
  it('knows what is in the strip straight ahead', () => {
    expect(isInWalkingPath({ x: 0.4, y: 0.3, width: 0.2, height: 0.3 })).toBe(true);
    expect(isInWalkingPath({ x: 0.05, y: 0.3, width: 0.15, height: 0.3 })).toBe(false);
    expect(isInWalkingPath({ x: 0.8, y: 0.3, width: 0.15, height: 0.3 })).toBe(false);
  });

  it('stays quiet about people off to the side, speaks about people close ahead', () => {
    expect(isQuiet({ riskLevel: 'info', inPath: false, approaching: false, meters: 2 })).toBe(true);
    expect(isQuiet({ riskLevel: 'info', inPath: true, approaching: false, meters: 2 })).toBe(false);
    expect(isQuiet({ riskLevel: 'info', inPath: true, approaching: false, meters: 8 })).toBe(true);
  });

  it('always speaks about near vehicles and anything dangerous coming closer', () => {
    expect(isQuiet({ riskLevel: 'critical', inPath: false, approaching: false, meters: 5 })).toBe(false);
    expect(isQuiet({ riskLevel: 'critical', inPath: false, approaching: true, meters: 12 })).toBe(false);
    expect(isQuiet({ riskLevel: 'critical', inPath: false, approaching: false, meters: 12 })).toBe(true);
  });

  it('mentions poles and benches only when about to bump into them', () => {
    expect(isQuiet({ riskLevel: 'warning', inPath: true, approaching: false, meters: 3 })).toBe(false);
    expect(isQuiet({ riskLevel: 'warning', inPath: false, approaching: false, meters: 3 })).toBe(true);
    expect(isQuiet({ riskLevel: 'warning', inPath: false, approaching: false, meters: 1 })).toBe(false);
  });
});

describe('approaching hazards', () => {
  it('says "approaching" and raises the risk of a moving hazard', () => {
    const still = classifyHazard(det('person', 0.9));
    const coming = classifyHazard(det('person', 0.9), { approaching: true });
    expect(coming.announcement).toMatch(/^Approaching person ahead/);
    expect(still.riskLevel).toBe('info');
    expect(coming.riskLevel).toBe('warning');
  });

  it('does not raise the risk of things that cannot move (the user is walking toward them)', () => {
    expect(classifyHazard(det('bench', 0.9), { approaching: true }).riskLevel).toBe('warning');
  });

  it('ranks the hazard in the walking path above one at the side', () => {
    const side = classifyHazard(det('car', 0.9, 0.0, 0.3));
    const ahead = classifyHazard(det('car', 0.9, 0.4, 0.3));
    expect(sortByDanger([side, ahead])[0]).toBe(ahead);
  });
});

describe('per-class confidence', () => {
  it('lets dangerous classes through at lower confidence than people', () => {
    expect(confidenceThresholdFor('pothole')).toBeLessThan(confidenceThresholdFor('person'));
    expect(MIN_CONFIDENCE_THRESHOLD).toBe(confidenceThresholdFor('pothole'));
    const kept = objectDetectionService.filterConfident([det('car', 0.42), det('person', 0.42)]);
    expect(kept.map((d) => d.label)).toEqual(['car']);
  });
});

describe('hazardAnnouncer', () => {
  beforeEach(() => detectionThrottle.reset());

  const hazard = (over: Partial<DetectedHazard>): DetectedHazard => ({
    label: 'car',
    direction: 'ahead',
    distanceEstimate: '3 meters',
    riskLevel: 'critical',
    announcement: 'Car ahead, 3 meters',
    confidence: 0.9,
    source: 'camera',
    ...over,
  });

  it('does not speak quiet hazards', () => {
    const speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    hazardAnnouncer.announce([hazard({ quiet: true })]);
    expect(speak).not.toHaveBeenCalled();
    speak.mockRestore();
  });

  it('speaks again when a known hazard starts approaching', () => {
    const speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    hazardAnnouncer.announce([hazard({})]);
    hazardAnnouncer.announce([hazard({})]);
    hazardAnnouncer.announce([hazard({ approaching: true, announcement: 'Approaching car ahead, 3 meters' })]);
    expect(speak).toHaveBeenCalledTimes(2);
    speak.mockRestore();
  });
});
