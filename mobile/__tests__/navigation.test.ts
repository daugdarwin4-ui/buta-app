/**
 * Unit Tests — live walking guidance (turn progress, off-route detection, spoken text)
 */
import { routingService } from '../src/services/navigation/routing.service';
import type { RoutePlan } from '../src/types/navigation.types';

// Straight north ~200 m, then east ~100 m
const A = { latitude: 9.3, longitude: 123.3 };
const B = { latitude: 9.3018, longitude: 123.3 };
const C = { latitude: 9.3018, longitude: 123.3009 };

const step = (instruction: string, maneuver: any, startLocation: typeof A) => ({
  instruction,
  maneuver,
  startLocation,
  endLocation: startLocation,
  distanceMeters: 0,
  distanceText: '',
  durationSeconds: 0,
  durationText: '',
});

const route = {
  polyline: [A, B, C],
  steps: [
    step('Head forward onto Perdices Street', 'straight', A),
    step('Turn right onto Rizal Street', 'turn-right', B),
    step('You have arrived at Market', 'arrive', C),
  ],
} as unknown as RoutePlan;

describe('routingService live guidance', () => {
  it('starts guidance at the first turn, not the depart step', () => {
    expect(routingService.firstGuidanceIndex(route)).toBe(1);
  });

  it('reports ~200 m to the turn at the start, with no event', () => {
    const r = routingService.evaluateProgress(A, route, 1);
    expect(r.event).toBeNull();
    expect(r.distance).toBeGreaterThan(195);
    expect(r.distance).toBeLessThan(205);
  });

  it('gives a heads-up about 25 m before the turn', () => {
    expect(routingService.evaluateProgress({ latitude: 9.30158, longitude: 123.3 }, route, 1).event).toBe('approaching');
  });

  it('advances when the turn is reached', () => {
    expect(routingService.evaluateProgress({ latitude: 9.30175, longitude: 123.3 }, route, 1).event).toBe('advanced');
  });

  it('announces arrival at the last step', () => {
    expect(routingService.evaluateProgress({ latitude: 9.3018, longitude: 123.30088 }, route, 2).event).toBe('arrived');
  });

  it('treats a few meters beside the street as on route', () => {
    expect(routingService.distanceFromRoute({ latitude: 9.3009, longitude: 123.30005 }, route.polyline)).toBeLessThan(10);
  });

  it('detects being ~55 m away from the street as off route', () => {
    expect(routingService.distanceFromRoute({ latitude: 9.3009, longitude: 123.3005 }, route.polyline)).toBeGreaterThan(35);
  });

  it('speaks the live distance before the instruction', () => {
    expect(routingService.formatStep(route.steps[1], 203)).toBe('In 205 meters, turn right onto Rizal Street');
    expect(routingService.formatStep(route.steps[2], 3)).toBe('You have arrived at Market');
  });
});

// ─── Walking time shown and spoken ────────────────────────────────────────────
import { formatDuration } from '../src/services/navigation/routing.service';
import { DEFAULT_SETTINGS } from '../src/types/user.types';

describe('formatDuration', () => {
  it('keeps short walks in minutes', () => {
    expect(formatDuration(30)).toBe('1 min');
    expect(formatDuration(11 * 60)).toBe('11 min');
    expect(formatDuration(11 * 60, true)).toBe('11 minutes');
    expect(formatDuration(60, true)).toBe('1 minute');
  });

  it('shows long walks in hours, not a huge minute count', () => {
    expect(formatDuration(1026 * 60)).toBe('17 h 6 min');
    expect(formatDuration(1026 * 60, true)).toBe('17 hours 6 minutes');
    expect(formatDuration(2 * 3600)).toBe('2 h');
    expect(formatDuration(3600, true)).toBe('1 hour');
  });
});

describe('default settings', () => {
  it('speaks Philippine English by default', () => {
    expect(DEFAULT_SETTINGS.tts_language).toBe('en-PH');
  });
});
