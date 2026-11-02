/**
 * Unit Tests — voice warning rule: stairs, vehicles, people and animals by name;
 * other objects "obstacle"; voice priority stairs > vehicles > living > obstacles
 */
import { groupWarning, spokenWarning, voiceRank, NAME_CONFIDENCE } from '../src/services/detection/spokenWarning';
import { hazardAnnouncer } from '../src/services/detection/hazardAnnouncer';
import { detectionThrottle } from '../src/services/detection/detectionThrottle';
import { ttsService } from '../src/services/tts/tts.service';
import { hapticsService } from '../src/services/haptics/haptics.service';
import { GUIDEAI_LABELS } from '../src/services/detection/yolo/yoloLabels';
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
  it('names stairs', () => {
    expect(spokenWarning(hazard({ label: 'stairs' }))).toBe('Careful, stairs ahead.');
    expect(spokenWarning(hazard({ label: 'stairs', direction: 'left' }))).toBe('Careful, stairs on your left.');
  });

  it('names vehicles, parked or moving', () => {
    expect(spokenWarning(hazard({ label: 'car' }))).toBe('Careful, car ahead.');
    expect(spokenWarning(hazard({ label: 'car', direction: 'right' }))).toBe('Careful, car on your right.');
    expect(spokenWarning(hazard({ label: 'motorcycle' }))).toBe('Careful, motorcycle ahead.');
    expect(spokenWarning(hazard({ label: 'truck' }))).toBe('Careful, truck ahead.');
    expect(spokenWarning(hazard({ label: 'bus' }))).toBe('Careful, bus ahead.');
    expect(spokenWarning(hazard({ label: 'bicycle' }))).toBe('Careful, bicycle ahead.');
    expect(spokenWarning(hazard({ label: 'jeepney' }))).toBe('Careful, jeepney ahead.');
    expect(spokenWarning(hazard({ label: 'tricycle', approaching: true }))).toBe('Careful, tricycle ahead.');
  });

  it('names people and animals', () => {
    expect(spokenWarning(hazard({ label: 'person' }))).toBe('Careful, person ahead.');
    expect(spokenWarning(hazard({ label: 'dog' }))).toBe('Careful, dog ahead.');
    expect(spokenWarning(hazard({ label: 'cat' }))).toBe('Careful, cat ahead.');
    expect(spokenWarning(hazard({ label: 'cow', direction: 'left' }))).toBe('Careful, cow on your left.');
  });

  it('says "obstacle" for furniture and other ordinary objects', () => {
    for (const label of ['chair', 'bench', 'pole', 'barrier', 'cart', 'potted plant', 'fire hydrant']) {
      expect(spokenWarning(hazard({ label }))).toBe('Careful, obstacle ahead.');
    }
    // "table" is not a class of this model; anything unknown is an obstacle
    expect(spokenWarning(hazard({ label: 'table' }))).toBe('Careful, obstacle ahead.');
  });

  it('only names a class when the model is reasonably sure (a floor pattern is not called stairs)', () => {
    expect(spokenWarning(hazard({ label: 'stairs', confidence: NAME_CONFIDENCE - 0.01 }))).toBe('Careful, obstacle ahead.');
    expect(spokenWarning(hazard({ label: 'stairs', confidence: NAME_CONFIDENCE }))).toBe('Careful, stairs ahead.');
  });

  it('speaks no distance, and leaves cane alerts as they are', () => {
    expect(spokenWarning(hazard({ distanceEstimate: 'very close' }))).not.toMatch(/close|near|meter|\d/);
    expect(spokenWarning(hazard({ source: 'cane', label: 'drop', announcement: 'Stop. Drop ahead.' }))).toBe('Stop. Drop ahead.');
  });

  it('only names classes the trained model actually has', () => {
    const named = ['stairs', 'car', 'motorcycle', 'truck', 'bus', 'bicycle', 'tricycle', 'jeepney', 'person', 'dog', 'cat', 'cow', 'horse'];
    for (const label of named) expect(GUIDEAI_LABELS).toContain(label);
  });

  it('ranks stairs and fall hazards, then vehicles, then living things, then obstacles', () => {
    expect(voiceRank('stairs')).toBe(0);
    expect(voiceRank('pothole')).toBe(0);
    expect(voiceRank('car')).toBe(1);
    expect(voiceRank('person')).toBe(2);
    expect(voiceRank('chair')).toBe(3);
  });
});

describe('groupWarning', () => {
  it('counts several people or vehicles in the same direction', () => {
    expect(groupWarning(hazard({ label: 'person' }), 2)).toBe('Careful, two people ahead.');
    expect(groupWarning(hazard({ label: 'car', direction: 'left' }), 3)).toBe('Careful, three cars on your left.');
    expect(groupWarning(hazard({ label: 'motorcycle' }), 5)).toBe('Careful, several motorcycles ahead.');
  });

  it('keeps the single warning for one object, obstacles, stairs and unsure names', () => {
    expect(groupWarning(hazard({ label: 'person' }), 1)).toBe('Careful, person ahead.');
    expect(groupWarning(hazard({ label: 'chair' }), 3)).toBe('Careful, obstacle ahead.');
    expect(groupWarning(hazard({ label: 'stairs' }), 2)).toBe('Careful, stairs ahead.');
    expect(groupWarning(hazard({ label: 'person', confidence: 0.4 }), 2)).toBe('Careful, obstacle ahead.');
  });
});

describe('hazardAnnouncer with the voice rule', () => {
  let speak: jest.SpyInstance;
  let speakImmediate: jest.SpyInstance;
  let speaking: jest.SpyInstance;
  beforeEach(() => {
    detectionThrottle.reset();
    hazardAnnouncer.reset();
    speak = jest.spyOn(ttsService, 'speak').mockImplementation(() => {});
    speakImmediate = jest.spyOn(ttsService, 'speakImmediate').mockImplementation(() => {});
    jest.spyOn(hapticsService, 'triggerForRisk').mockImplementation(async () => {});
    speaking = jest.spyOn(ttsService, 'speakingPriority', 'get').mockReturnValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('stairs, car, motorcycle, truck, person, dog: named', () => {
    const cases: [Partial<DetectedHazard>, string][] = [
      [{ label: 'stairs', riskLevel: 'critical' }, 'Careful, stairs ahead.'],
      [{ label: 'car', riskLevel: 'critical', direction: 'right' }, 'Careful, car on your right.'],
      [{ label: 'motorcycle', riskLevel: 'critical', direction: 'left' }, 'Careful, motorcycle on your left.'],
      [{ label: 'truck', riskLevel: 'critical' }, 'Careful, truck ahead.'],
      [{ label: 'person', riskLevel: 'info', direction: 'right' }, 'Careful, person on your right.'],
      [{ label: 'dog', riskLevel: 'info', direction: 'left' }, 'Careful, dog on your left.'],
    ];
    for (const [over, text] of cases) {
      hazardAnnouncer.announce([hazard(over)]);
      expect(speak).toHaveBeenLastCalledWith(text, over.riskLevel);
    }
  });

  it('chair / table: "obstacle"', () => {
    hazardAnnouncer.announce([hazard({ label: 'chair' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle ahead.', 'warning');
    hazardAnnouncer.announce([hazard({ label: 'table', direction: 'left' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, obstacle on your left.', 'warning');
  });

  it('several at once: one sentence in voice-priority order (stairs, vehicle, person, obstacle)', () => {
    hazardAnnouncer.announce([
      hazard({ label: 'chair' }),
      hazard({ label: 'person', riskLevel: 'info', direction: 'right' }),
      hazard({ label: 'car', riskLevel: 'critical', direction: 'left' }),
      hazard({ label: 'stairs', riskLevel: 'critical' }),
    ]);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('Careful, stairs ahead. Also car on your left.', 'critical');
  });

  it('a person comes before a chair, even though chairs have the higher risk level', () => {
    hazardAnnouncer.announce([hazard({ label: 'chair' }), hazard({ label: 'person', riskLevel: 'info', direction: 'left' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, person on your left. Also obstacle ahead.', 'info');
  });

  it('two people ahead are announced as a group, once', () => {
    hazardAnnouncer.announce([
      hazard({ label: 'person', riskLevel: 'info' }),
      hazard({ label: 'person', riskLevel: 'info', confidence: 0.7 }),
    ]);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('Careful, two people ahead.', 'info');
  });

  it('nothing nearby (only quiet, far or off-path objects): silent', () => {
    hazardAnnouncer.announce([hazard({ quiet: true }), hazard({ label: 'car', riskLevel: 'critical', quiet: true })]);
    hazardAnnouncer.announce([]);
    expect(speak).not.toHaveBeenCalled();
  });

  it('does not repeat the same warning every frame', () => {
    hazardAnnouncer.announce([hazard({ label: 'stairs', riskLevel: 'critical' })]);
    hazardAnnouncer.announce([hazard({ label: 'stairs', riskLevel: 'critical' })]);
    hazardAnnouncer.announce([hazard({ label: 'chair' })]);
    hazardAnnouncer.announce([hazard({ label: 'bench' })]);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('a higher-priority hazard cuts into a lower-priority alert being spoken', () => {
    hazardAnnouncer.announce([hazard({ label: 'chair' })]); // speaking "obstacle" (warning)
    speaking.mockReturnValue(1);
    hazardAnnouncer.announce([hazard({ label: 'person', riskLevel: 'info', direction: 'left' })]);
    expect(speakImmediate).toHaveBeenLastCalledWith('Careful, person on your left.', 'info');
  });

  it('a lower-priority hazard waits for the alert being spoken', () => {
    hazardAnnouncer.announce([hazard({ label: 'person', riskLevel: 'info' })]); // speaking "person" (info)
    speaking.mockReturnValue(2);
    hazardAnnouncer.announce([hazard({ label: 'chair', direction: 'left' })]);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speakImmediate).not.toHaveBeenCalled();
  });

  it('stairs cut into a vehicle alert', () => {
    hazardAnnouncer.announce([hazard({ label: 'car', riskLevel: 'critical' })]);
    speaking.mockReturnValue(0);
    hazardAnnouncer.announce([hazard({ label: 'stairs', riskLevel: 'critical', direction: 'right' })]);
    expect(speak).toHaveBeenLastCalledWith('Careful, stairs on your right.', 'critical');
  });
});
