/**
 * Unit Tests — tracker low-confidence rescue, measured speed, zone summary, stairs wording,
 * and urgency with proximity bands
 */
import { HazardTracker } from '../src/services/detection/hazardTracker';
import { PerfMeter } from '../src/services/detection/perfMeter';
import { summarizeZones } from '../src/components/detection/DetectionHud';
import { HAZARD_CLASSES } from '../src/constants/hazards';
import { isUrgentNow, combineAnnouncements } from '../src/services/detection/hazardAnnouncer';
import type { DetectedHazard, RawDetection } from '../src/types/detection.types';

const det = (label: string, confidence: number, x = 0.4): RawDetection => ({
  classId: 0,
  label,
  confidence,
  bbox: { x, y: 0.3, width: 0.2, height: 0.4 },
});

describe('HazardTracker low-confidence rescue', () => {
  it('keeps a known object alive with an unsure detection of it', () => {
    const tracker = new HazardTracker();
    tracker.update([det('motorcycle', 0.8)], 0);
    // Too unsure to report on its own, but it overlaps the motorcycle we already know
    for (let t = 1; t <= 4; t++) {
      const out = tracker.update([], t * 300, [det('motorcycle', 0.25)]);
      expect(out.map((d) => d.label)).toEqual(['motorcycle']);
    }
  });

  it('drops the object without that help', () => {
    const tracker = new HazardTracker();
    tracker.update([det('motorcycle', 0.8)], 0);
    tracker.update([], 300);
    expect(tracker.update([], 600)).toEqual([]);
  });

  it('never creates a new object from unsure detections', () => {
    const tracker = new HazardTracker();
    for (let t = 0; t < 5; t++) expect(tracker.update([], t * 300, [det('car', 0.25)])).toEqual([]);
  });

  it('does not let an unsure detection of another class rescue an object', () => {
    const tracker = new HazardTracker();
    tracker.update([det('motorcycle', 0.8)], 0);
    tracker.update([], 300, [det('bicycle', 0.25)]);
    expect(tracker.update([], 600, [det('bicycle', 0.25)])).toEqual([]);
  });

  it('smooths a jumping box instead of following it fully', () => {
    const tracker = new HazardTracker();
    tracker.update([det('car', 0.8, 0.2)], 0);
    const [car] = tracker.update([det('car', 0.8, 0.3)], 300);
    expect(car.bbox.x).toBeGreaterThan(0.2);
    expect(car.bbox.x).toBeLessThan(0.3);
  });
});

describe('HazardTracker stricter confirmation for stairs', () => {
  const stairs = (confidence: number): RawDetection => ({
    classId: 14,
    label: 'stairs',
    confidence,
    bbox: { x: 0.2, y: 0.5, width: 0.6, height: 0.5 },
  });

  it('never reports stairs from one frame, even with high confidence', () => {
    const tracker = new HazardTracker();
    expect(tracker.update([stairs(0.95)], 0)).toEqual([]);
  });

  it('does not report stairs seen in only 2 of 4 frames (flicker on a striped floor)', () => {
    const tracker = new HazardTracker();
    expect(tracker.update([stairs(0.6)], 0)).toEqual([]);
    expect(tracker.update([], 300)).toEqual([]);
    expect(tracker.update([stairs(0.6)], 600)).toEqual([]);
  });

  it('reports stairs once seen in 3 of the last 4 frames', () => {
    const tracker = new HazardTracker();
    tracker.update([stairs(0.6)], 0);
    tracker.update([stairs(0.6)], 300);
    const out = tracker.update([stairs(0.6)], 600);
    expect(out.map((d) => d.label)).toEqual(['stairs']);
  });

  it('does not keep stairs alive with weak guesses below the threshold', () => {
    const tracker = new HazardTracker();
    tracker.update([stairs(0.6)], 0);
    tracker.update([stairs(0.6)], 300);
    tracker.update([stairs(0.6)], 600); // confirmed
    // Only weak guesses now (e.g. a blurry floor): stairs must disappear, not linger
    tracker.update([], 900, [stairs(0.24)]);
    expect(tracker.update([], 1200, [stairs(0.24)])).toEqual([]);
  });

  it('writes "Caution, approaching stairs" in lower case after the comma', () => {
    expect(HAZARD_CLASSES.stairs.announcementTemplate('ahead', 'near', true)).toBe('Caution, approaching stairs ahead, near');
  });

  it('keeps the quick rule for other classes (a confident car is reported at once)', () => {
    const tracker = new HazardTracker();
    const out = tracker.update([det('car', 0.9)], 0);
    expect(out.map((d) => d.label)).toEqual(['car']);
  });
});

describe('full-frame guesses', () => {
  it('ignores an unsure box covering the whole picture (a dim or blank view), but not a sure one', () => {
    const { isFullFrameGuess } = require('../src/services/detection/fullFrameGuess');
    expect(isFullFrameGuess({ confidence: 0.36, bbox: { width: 1, height: 0.95 } })).toBe(true);
    expect(isFullFrameGuess({ confidence: 0.8, bbox: { width: 1, height: 0.95 } })).toBe(false);
    expect(isFullFrameGuess({ confidence: 0.36, bbox: { width: 0.5, height: 0.6 } })).toBe(false);
  });
});

describe('PerfMeter', () => {
  it('measures frames per second and average model time from timestamps', () => {
    const meter = new PerfMeter();
    [0, 250, 500, 750, 1000].forEach((t, i) => meter.record(80 + i * 10, t));
    const stats = meter.snapshot(1000);
    expect(stats.fps).toBeCloseTo(4);
    expect(stats.inferenceMs).toBeCloseTo(100);
  });

  it('reports zero when nothing has been analysed recently', () => {
    const meter = new PerfMeter();
    expect(meter.snapshot(0)).toEqual({ fps: 0, inferenceMs: 0 });
    meter.record(50, 0);
    meter.record(50, 300);
    expect(meter.snapshot(10000)).toEqual({ fps: 0, inferenceMs: 0 });
  });
});

const hazard = (over: Partial<DetectedHazard>): DetectedHazard => ({
  label: 'car',
  direction: 'ahead',
  distanceEstimate: 'moderate distance',
  riskLevel: 'critical',
  announcement: 'Car ahead, moderate distance',
  confidence: 0.8,
  source: 'camera',
  ...over,
});

describe('zone summary', () => {
  it('counts objects per zone and keeps the most serious risk', () => {
    const zones = summarizeZones([
      hazard({ direction: 'left', riskLevel: 'info' }),
      hazard({ direction: 'left', riskLevel: 'critical' }),
      hazard({ direction: 'right', riskLevel: 'warning' }),
    ]);
    expect(zones.left).toEqual({ count: 2, risk: 'critical' });
    expect(zones.ahead).toEqual({ count: 0, risk: null });
    expect(zones.right).toEqual({ count: 1, risk: 'warning' });
  });
});

describe('stairs and proximity wording', () => {
  it('opens a stairs alert with "Caution"', () => {
    expect(HAZARD_CLASSES.stairs.announcementTemplate('ahead', 'near')).toBe('Caution, stairs ahead, near');
    expect(HAZARD_CLASSES.stairs.announcementTemplate('left')).toBe('Caution, stairs on your left');
  });

  it('treats a "very close" critical hazard as urgent, but not a "near" one', () => {
    expect(isUrgentNow(hazard({ distanceEstimate: 'very close' }))).toBe(true);
    expect(isUrgentNow(hazard({ distanceEstimate: 'near' }))).toBe(false);
    // The cane still measures real meters
    expect(isUrgentNow(hazard({ distanceEstimate: 'less than 1 meter', source: 'cane' }))).toBe(true);
  });

  it('drops the proximity from the second item of a combined alert', () => {
    expect(combineAnnouncements(['Caution, stairs ahead, very close', 'Pole on your left, moderate distance'])).toBe(
      'Caution, stairs ahead, very close. Also pole on your left.'
    );
  });
});
