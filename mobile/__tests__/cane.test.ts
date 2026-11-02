/**
 * Unit Tests — cane device hazards and the shared announcer
 */
import { CaneHazardDetector, CANE_THRESHOLDS } from '../src/services/detection/caneHazards';
import { hazardAnnouncer } from '../src/services/detection/hazardAnnouncer';
import { detectionThrottle } from '../src/services/detection/detectionThrottle';
import { ttsService } from '../src/services/tts/tts.service';
import type { DetectedHazard } from '../src/types/detection.types';

const clear = { frontCm: 400, groundCm: 80 };

describe('CaneHazardDetector — front sensor', () => {
  const d = new CaneHazardDetector();

  it('says nothing when the path is clear', () => {
    expect(d.process(clear)).toEqual([]);
  });

  it('warns about an obstacle within 1.5 m', () => {
    const [h] = d.process({ frontCm: 120, groundCm: 80 });
    expect(h.label).toBe('obstacle');
    expect(h.riskLevel).toBe('warning');
    expect(h.announcement).toBe('Obstacle ahead at chest height, 1 meter.');
  });

  it('says stop when an obstacle is within 70 cm', () => {
    const [h] = d.process({ frontCm: 60, groundCm: 80 });
    expect(h.riskLevel).toBe('critical');
    expect(h.announcement).toMatch(/^Stop/);
  });

  it('ignores a missing reading (sensor error)', () => {
    expect(d.process({ frontCm: null, groundCm: null })).toEqual([]);
  });
});

describe('CaneHazardDetector — ground sensor', () => {
  let d: CaneHazardDetector;
  beforeEach(() => {
    d = new CaneHazardDetector();
  });

  it('needs two drop readings in a row (no false alarm from one glitch)', () => {
    expect(d.process({ frontCm: 400, groundCm: 150 })).toEqual([]);
    expect(d.process(clear)).toEqual([]);
    expect(d.process({ frontCm: 400, groundCm: 150 })).toEqual([]);
    const [h] = d.process({ frontCm: 400, groundCm: 160 });
    expect(h.label).toBe('drop');
    expect(h.riskLevel).toBe('critical');
  });

  it('treats out-of-range ground (nothing below) as a drop', () => {
    d.process({ frontCm: 400, groundCm: 200 });
    expect(d.process({ frontCm: 400, groundCm: 200 })[0].label).toBe('drop');
  });

  it('warns about a step or curb when the ground is suddenly closer', () => {
    const [h] = d.process({ frontCm: 400, groundCm: 55 });
    expect(h.label).toBe('step');
    expect(h.riskLevel).toBe('warning');
  });

  it('learns how high this user holds the cane', () => {
    for (let i = 0; i < 40; i++) d.process({ frontCm: 400, groundCm: 92 });
    expect(d.baselineCm).toBeGreaterThan(90);
    // 92 is now normal ground, not a drop
    expect(d.process({ frontCm: 400, groundCm: 95 })).toEqual([]);
  });

  it('does not learn from drops or steps', () => {
    for (let i = 0; i < 10; i++) d.process({ frontCm: 400, groundCm: 200 });
    expect(d.baselineCm).toBe(CANE_THRESHOLDS.groundDefaultCm);
  });
});

describe('hazardAnnouncer', () => {
  const hazard = (riskLevel: DetectedHazard['riskLevel'], label = 'obstacle'): DetectedHazard => ({
    label,
    direction: 'ahead',
    distanceEstimate: null,
    riskLevel,
    announcement: `${label} ${riskLevel}`,
    confidence: 1,
    source: 'cane',
  });

  let speak: jest.SpyInstance;
  beforeEach(() => {
    detectionThrottle.reset();
    hazardAnnouncer.reset();
    speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
  });
  afterEach(() => speak.mockRestore());

  it('does not repeat the same hazard within the throttle window', () => {
    hazardAnnouncer.announce([hazard('warning')]);
    hazardAnnouncer.announce([hazard('warning')]);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('announces right away when the same hazard becomes more dangerous', () => {
    hazardAnnouncer.announce([hazard('warning')]);
    hazardAnnouncer.announce([hazard('critical')]);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('obstacle critical.', 'critical');
  });

  it('speaks everything in one sentence, most dangerous first', () => {
    hazardAnnouncer.announce([hazard('info', 'dog'), hazard('critical', 'drop')]);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('drop critical. Also dog info.', 'critical');
  });
});
