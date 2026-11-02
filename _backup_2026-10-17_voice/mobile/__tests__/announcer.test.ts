/**
 * Unit Tests — hazard alerts no longer cut each other off
 */
import { combineAnnouncements, hazardAnnouncer, isUrgentNow } from '../src/services/detection/hazardAnnouncer';
import { detectionThrottle } from '../src/services/detection/detectionThrottle';
import { ttsService } from '../src/services/tts/tts.service';
import { hapticsService } from '../src/services/haptics/haptics.service';
import type { DetectedHazard } from '../src/types/detection.types';

const hazard = (over: Partial<DetectedHazard> = {}): DetectedHazard => ({
  label: 'car',
  direction: 'ahead',
  distanceEstimate: '3 meters',
  riskLevel: 'critical',
  announcement: 'Car ahead, 3 meters',
  confidence: 0.9,
  source: 'camera',
  ...over,
});
const motorcycle = hazard({ label: 'motorcycle', direction: 'right', announcement: 'Motorcycle on your right, 4 meters' });
const bench = hazard({ label: 'bench', riskLevel: 'warning', announcement: 'Bench ahead, 2 meters' });

describe('combineAnnouncements', () => {
  it('speaks one hazard as it is', () => {
    expect(combineAnnouncements(['Car ahead, 3 meters'])).toBe('Car ahead, 3 meters.');
  });

  it('joins hazards into one sentence and keeps the later ones short', () => {
    expect(combineAnnouncements(['Car ahead, 3 meters', 'Motorcycle on your right, 4 meters'])).toBe(
      'Car ahead, 3 meters. Also motorcycle on your right.'
    );
    expect(combineAnnouncements(['Stairs ahead, less than 1 meter.', 'Pole on your left, 1.5 meters.'])).toBe(
      'Stairs ahead, less than 1 meter. Also pole on your left.'
    );
  });
});

describe('isUrgentNow', () => {
  it('is true for critical hazards that are approaching or within about a meter', () => {
    expect(isUrgentNow(hazard({ approaching: true }))).toBe(true);
    expect(isUrgentNow(hazard({ distanceEstimate: 'less than 1 meter' }))).toBe(true);
    expect(isUrgentNow(hazard())).toBe(false);
    expect(isUrgentNow(hazard({ riskLevel: 'warning', approaching: true }))).toBe(false);
  });
});

describe('hazardAnnouncer while the voice is busy', () => {
  let speak: jest.SpyInstance;
  let buzz: jest.SpyInstance;
  let speaking: jest.SpyInstance;
  /** null = silent, 0 = a critical alert is being spoken, 2 = an info message */
  const setSpeaking = (priority: number | null) => speaking.mockReturnValue(priority);

  beforeEach(() => {
    detectionThrottle.reset();
    hazardAnnouncer.reset();
    speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    buzz = jest.spyOn(hapticsService, 'triggerForRisk').mockImplementation(async () => {});
    speaking = jest.spyOn(ttsService, 'speakingPriority', 'get').mockReturnValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lets the alert being spoken finish instead of cutting it off', () => {
    hazardAnnouncer.announce([hazard()]);
    setSpeaking(0);
    hazardAnnouncer.announce([motorcycle]);
    hazardAnnouncer.announce([motorcycle]);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('speaks the waiting alert as soon as the voice is free (it was not lost)', () => {
    hazardAnnouncer.announce([hazard()]);
    setSpeaking(0);
    hazardAnnouncer.announce([motorcycle]);
    setSpeaking(null);
    hazardAnnouncer.announce([motorcycle]);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('Motorcycle on your right, 4 meters.', 'critical');
  });

  it('still vibrates at once for a critical hazard that has to wait, but only once', () => {
    hazardAnnouncer.announce([hazard()]);
    buzz.mockClear();
    setSpeaking(0);
    hazardAnnouncer.announce([motorcycle]);
    hazardAnnouncer.announce([motorcycle]);
    expect(buzz).toHaveBeenCalledTimes(1);
  });

  it('cuts in for something urgent: approaching, or within about a meter', () => {
    hazardAnnouncer.announce([hazard()]);
    setSpeaking(0);
    hazardAnnouncer.announce([hazard({ label: 'motorcycle', approaching: true, announcement: 'Approaching motorcycle ahead, 4 meters' })]);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('does not let an alert interrupt itself', () => {
    const close = hazard({ distanceEstimate: 'less than 1 meter', announcement: 'Car ahead, less than 1 meter' });
    hazardAnnouncer.announce([close]);
    setSpeaking(0);
    hazardAnnouncer.announce([close]);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('interrupts less important speech (a navigation step) for a critical hazard', () => {
    setSpeaking(2);
    hazardAnnouncer.announce([hazard()]);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('makes a minor obstacle wait for a critical alert', () => {
    setSpeaking(0);
    hazardAnnouncer.announce([bench]);
    expect(speak).not.toHaveBeenCalled();
    setSpeaking(null);
    hazardAnnouncer.announce([bench]);
    expect(speak).toHaveBeenCalledWith('Bench ahead, 2 meters.', 'warning');
  });
});
