/**
 * Unit Tests — voice warning rule: living things by name, everything else "obstacle"
 */
import { spokenWarning } from '../src/services/detection/spokenWarning';
import { hazardAnnouncer } from '../src/services/detection/hazardAnnouncer';
import { detectionThrottle } from '../src/services/detection/detectionThrottle';
import { ttsService } from '../src/services/tts/tts.service';
import { hapticsService } from '../src/services/haptics/haptics.service';
import type { DetectedHazard } from '../src/types/detection.types';

const hazard = (over: Partial<DetectedHazard> = {}): DetectedHazard => ({
  label: 'chair',
  direction: 'ahead',
  distanceEstimate: 'near',
  riskLevel: 'warning',
  announcement: 'Chair ahead, near',
  confidence: 0.8,
  source: 'camera',
  ...over,
});

describe('spokenWarning', () => {
  it('names living things the model knows', () => {
    expect(spokenWarning(hazard({ label: 'person' }))).toBe('Careful, person ahead.');
    expect(spokenWarning(hazard({ label: 'dog' }))).toBe('Careful, dog ahead.');
    expect(spokenWarning(hazard({ label: 'cat' }))).toBe('Careful, cat ahead.');
    expect(spokenWarning(hazard({ label: 'cow', direction: 'left' }))).toBe('Careful, cow on your left.');
    expect(spokenWarning(hazard({ label: 'horse', direction: 'right' }))).toBe('Careful, horse on your right.');
  });

  it('never says the name of a non-living object', () => {
    for (const label of ['chair', 'motorcycle', 'stairs', 'car', 'pothole', 'open_drainage', 'bench', 'pole']) {
      expect(spokenWarning(hazard({ label }))).toBe('Careful, obstacle ahead.');
    }
    expect(spokenWarning(hazard({ label: 'motorcycle', direction: 'left' }))).toBe('Careful, obstacle on your left.');
    expect(spokenWarning(hazard({ label: 'stairs', direction: 'right' }))).toBe('Careful, obstacle on your right.');
  });

  it('speaks no distance', () => {
    expect(spokenWarning(hazard({ distanceEstimate: 'very close' }))).not.toMatch(/close|near|meter|\d/);
  });

  it('leaves cane alerts as they are', () => {
    expect(spokenWarning(hazard({ source: 'cane', label: 'drop', announcement: 'Stop. Drop ahead.' }))).toBe('Stop. Drop ahead.');
  });
});

describe('hazardAnnouncer with the voice rule', () => {
  let speak: jest.SpyInstance;
  beforeEach(() => {
    detectionThrottle.reset();
    hazardAnnouncer.reset();
    speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    jest.spyOn(hapticsService, 'triggerForRisk').mockImplementation(async () => {});
    jest.spyOn(ttsService, 'speakingPriority', 'get').mockReturnValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('person / dog / cat near: named', () => {
    hazardAnnouncer.announce([hazard({ label: 'person', riskLevel: 'info' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, person ahead.', 'info');
    hazardAnnouncer.announce([hazard({ label: 'dog', riskLevel: 'info', direction: 'left' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, dog on your left.', 'info');
    hazardAnnouncer.announce([hazard({ label: 'cat', riskLevel: 'info', direction: 'right' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, cat on your right.', 'info');
  });

  it('chair / motorcycle / stairs near: "obstacle"', () => {
    hazardAnnouncer.announce([hazard({ label: 'stairs', riskLevel: 'critical' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle ahead.', 'critical');
    hazardAnnouncer.announce([hazard({ label: 'motorcycle', riskLevel: 'critical', direction: 'left' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle on your left.', 'critical');
    hazardAnnouncer.announce([hazard({ label: 'chair', direction: 'right' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle on your right.', 'warning');
  });

  it('several obstacles: one sentence, most dangerous first, the same phrase only once', () => {
    hazardAnnouncer.announce([
      hazard({ label: 'chair' }),
      hazard({ label: 'motorcycle', riskLevel: 'critical' }),
      hazard({ label: 'person', riskLevel: 'info', direction: 'right' }),
    ]);
    expect(speak).toHaveBeenCalledTimes(1);
    // motorcycle (critical) first; the chair is the same "obstacle ahead", so not said twice
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle ahead. Also person on your right.', 'critical');
  });

  it('nothing nearby (only quiet, far or off-path objects): silent', () => {
    hazardAnnouncer.announce([hazard({ quiet: true }), hazard({ label: 'person', quiet: true })]);
    hazardAnnouncer.announce([]);
    expect(speak).not.toHaveBeenCalled();
  });

  it('does not repeat the same warning every frame, even for a different obstacle in the same place', () => {
    hazardAnnouncer.announce([hazard({ label: 'chair' })]);
    hazardAnnouncer.announce([hazard({ label: 'chair' })]);
    hazardAnnouncer.announce([hazard({ label: 'bench' })]);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('warns again when a new obstacle appears elsewhere or becomes more dangerous', () => {
    hazardAnnouncer.announce([hazard({ label: 'car', riskLevel: 'critical' })]);
    hazardAnnouncer.announce([hazard({ label: 'chair', direction: 'left' })]);
    expect(speak).toHaveBeenCalledTimes(2);
    hazardAnnouncer.announce([hazard({ label: 'car', riskLevel: 'critical', approaching: true })]);
    expect(speak).toHaveBeenCalledTimes(3);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle ahead.', 'critical');
  });
});
