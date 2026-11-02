/**
 * Unit Tests — AI object identification on top of YOLO: parsing Gemini's answer, matching it to
 * YOLO objects, scheduling scans, and the JPEG encoder
 */
import { decode } from 'jpeg-js';
import { parseIdentifiedObjects, type IdentifiedObject } from '../src/services/ai/gemini.service';
import {
  EXTRA_TTL_MS,
  SceneIdentifier,
  mergeIdentifications,
  sameKind,
  spokenName,
} from '../src/services/ai/sceneIdentifier';
import { rgbToJpegBase64, toBase64 } from '../src/utils/jpeg';
import { describeAiScan } from '../src/components/detection/DetectionHud';
import { vocabularyWith } from '../src/constants/vocabulary';
import type { DetectedHazard } from '../src/types/detection.types';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const yolo = (label: string, trackId: number, b = box(0.1, 0.1, 0.3, 0.5)): DetectedHazard => ({
  label,
  direction: 'ahead',
  distanceEstimate: 'near',
  riskLevel: 'warning',
  announcement: `${label} ahead, near`,
  confidence: 0.8,
  source: 'camera',
  bbox: b,
  trackId,
});
const obj = (name: string, b = box(0.1, 0.1, 0.3, 0.5), certainty: IdentifiedObject['certainty'] = 'high', category = 'other'): IdentifiedObject => ({
  name,
  category,
  certainty,
  bbox: b,
});

describe('parseIdentifiedObjects', () => {
  it('turns Gemini box_2d [ymin, xmin, ymax, xmax] (0–1000) into 0–1 boxes', () => {
    const raw = JSON.stringify({ objects: [{ box_2d: [100, 200, 600, 500], name: 'Rice Cooker', category: 'Appliance', certainty: 'medium' }] });
    expect(parseIdentifiedObjects(raw)).toEqual([
      { name: 'rice cooker', category: 'appliance', certainty: 'medium', bbox: { x: 0.2, y: 0.1, width: 0.3, height: 0.5 } },
    ]);
  });

  it('drops malformed objects and impossible boxes, and rejects non-JSON', () => {
    const raw = JSON.stringify({
      objects: [
        { box_2d: [100, 200], name: 'broom', category: 'tool', certainty: 'high' },
        { box_2d: [100, 200, 100, 500], name: 'flat', category: 'x', certainty: 'high' },
        { box_2d: [0, 0, 500, 500], name: '', category: 'x', certainty: 'high' },
        { box_2d: [0, 0, 500, 500], name: 'fan', category: 'appliance', certainty: 'sure' },
      ],
    });
    const out = parseIdentifiedObjects(raw)!;
    expect(out.map((o) => o.name)).toEqual(['fan']);
    expect(out[0].certainty).toBe('low'); // unknown certainty is never upgraded
    expect(parseIdentifiedObjects('not json')).toBeNull();
  });
});

describe('mergeIdentifications', () => {
  it('gives a YOLO object a more specific name of the same kind', () => {
    const { names, extras } = mergeIdentifications([yolo('chair', 7)], [obj('monobloc chair')], 0);
    expect(names.get(7)).toEqual({ name: 'monobloc chair', certainty: 'high', disagrees: false });
    expect(extras).toEqual([]);
  });

  it('marks a disagreement instead of replacing the YOLO label (e.g. "car" that is a laptop)', () => {
    const { names } = mergeIdentifications([yolo('car', 3)], [obj('laptop', box(0.1, 0.1, 0.3, 0.5), 'high', 'electronics')], 0);
    expect(names.get(3)).toEqual({ name: 'laptop', certainty: 'high', disagrees: true });
  });

  it('adds objects YOLO has no box for as AI-only objects', () => {
    const { names, extras } = mergeIdentifications([yolo('person', 1)], [obj('broom', box(0.6, 0.5, 0.1, 0.4))], 42);
    expect(names.size).toBe(0);
    expect(extras).toEqual([{ name: 'broom', category: 'other', certainty: 'high', bbox: box(0.6, 0.5, 0.1, 0.4), seenAt: 42 }]);
  });

  it('ignores vague answers that add nothing to a YOLO label', () => {
    const { names, extras } = mergeIdentifications(
      [yolo('person', 1), yolo('chair', 2, box(0.6, 0.1, 0.3, 0.5))],
      [obj('person'), obj('seat', box(0.6, 0.1, 0.3, 0.5), 'low')],
      0
    );
    expect(names.size).toBe(0);
    expect(extras).toEqual([]);
  });

  it('matches each YOLO object at most once', () => {
    const { names, extras } = mergeIdentifications([yolo('person', 1)], [obj('student'), obj('vendor', box(0.12, 0.1, 0.3, 0.5))], 0);
    expect(names.size).toBe(1);
    expect(extras).toHaveLength(1);
  });
});

describe('wording', () => {
  it('knows which names are the same kind as a YOLO class', () => {
    expect(sameKind('motorcycle', 'scooter', 'vehicle')).toBe(true);
    expect(sameKind('cow', 'carabao', 'animal')).toBe(true);
    expect(sameKind('car', 'laptop', 'electronics')).toBe(false);
  });

  it('hedges names the AI is not sure of, without inventing a percentage', () => {
    expect(spokenName('rice cooker', 'high')).toBe('rice cooker');
    expect(spokenName('rice cooker', 'medium')).toBe('probably a rice cooker');
    expect(spokenName('electric fan', 'low')).toBe('possibly an electric fan');
    expect(spokenName('unknown object', 'low')).toBe('unknown object');
  });

  it('shows the AI scan status honestly', () => {
    expect(describeAiScan({ status: 'offline', extras: 0, lastScanAt: null })).toMatch(/offline/);
    expect(describeAiScan({ status: 'waiting', extras: 2, lastScanAt: 1000 }, 5000)).toBe('AI names: 2 more objects · 4 s ago');
  });

  it('puts taught names first in the vocabulary, without duplicates', () => {
    const v = vocabularyWith(['Banig Mat', 'jeepney']);
    expect(v[0]).toBe('banig mat');
    expect(v.filter((n) => n === 'jeepney')).toHaveLength(1);
  });
});

describe('SceneIdentifier scheduling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const rgb = new Uint8Array(32 * 32 * 3).fill(120);

  function setup(answer: IdentifiedObject[] | null = [obj('broom', box(0.6, 0.5, 0.1, 0.4))]) {
    let clock = 0;
    const requestFrame = jest.fn();
    const identify = jest.fn(async () => answer);
    const s = new SceneIdentifier({ requestFrame, identify, isAvailable: () => true, now: () => clock });
    return { s, requestFrame, identify, tick: (ms: number) => { clock += ms; jest.advanceTimersByTime(ms); } };
  }

  it('asks for a picture, sends it, and publishes the AI-only objects', async () => {
    const { s, requestFrame, identify, tick } = setup();
    s.start();
    tick(1500);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    await s.onHiResFrame(rgb, 32, 24, 32);
    expect(identify).toHaveBeenCalledTimes(1);
    const jpeg = (identify.mock.calls[0] as unknown[])[0] as string;
    expect(jpeg.startsWith('/9j/')).toBe(true); // a real JPEG
    expect(s.current.extras.map((e) => e.name)).toEqual(['broom']);
    expect(s.current.status).toBe('waiting');
  });

  it('never runs two scans at once and ignores extra pictures', async () => {
    const { s, identify, tick } = setup();
    s.start();
    tick(1500);
    await Promise.all([s.onHiResFrame(rgb, 32, 24, 32), s.onHiResFrame(rgb, 32, 24, 32)]);
    expect(identify).toHaveBeenCalledTimes(1);
  });

  it('reports offline when Gemini gives no answer, and forgets AI-only objects after a while', async () => {
    const { s, tick } = setup();
    s.start();
    tick(1500);
    await s.onHiResFrame(rgb, 32, 24, 32);
    tick(EXTRA_TTL_MS + 1);
    s.setDetections([]);
    expect(s.current.extras).toEqual([]);

    const off = setup(null);
    off.s.start();
    off.tick(1500);
    await off.s.onHiResFrame(rgb, 32, 24, 32);
    expect(off.s.current.status).toBe('offline');
  });

  it('removes AI-only boxes as soon as the camera turns to a different view, and looks again soon', async () => {
    const { s, requestFrame, tick } = setup();
    s.start();
    tick(1500);
    await s.onHiResFrame(rgb, 32, 24, 32);
    expect(s.current.extras).toHaveLength(1);
    // Same view: boxes stay
    s.onFrame(new Uint8Array(32 * 32 * 3).fill(122), 32, 24, 32);
    expect(s.current.extras).toHaveLength(1);
    // Turned to a much brighter wall: boxes go, a new scan follows within ~1.5 s
    s.onFrame(new Uint8Array(32 * 32 * 3).fill(240), 32, 24, 32);
    expect(s.current.extras).toEqual([]);
    const before = requestFrame.mock.calls.length;
    tick(1600);
    expect(requestFrame.mock.calls.length).toBe(before + 1);
  });

  it('does not show AI-only boxes from a picture the camera has already moved away from', async () => {
    const { s, tick } = setup();
    s.start();
    tick(1500);
    s.onFrame(new Uint8Array(32 * 32 * 3).fill(240), 32, 24, 32); // the view now (bright)
    await s.onHiResFrame(rgb, 32, 24, 32); // the answer is about an older, darker view
    expect(s.current.extras).toEqual([]);
  });

  it('drops an answer that arrives after detection stopped', async () => {
    const { s, tick } = setup();
    s.start();
    tick(1500);
    const pending = s.onHiResFrame(rgb, 32, 24, 32);
    s.stop();
    await pending;
    expect(s.current.extras).toEqual([]);
    expect(s.current.status).toBe('off');
  });
});

describe('JPEG encoder', () => {
  it('encodes a cropped RGB picture that decodes to the same size and colours', () => {
    const w = 16, h = 8;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) rgb.set([200, 40, 30], i * 3);
    const b64 = rgbToJpegBase64(rgb, w, { x: 4, y: 0, width: 8, height: 8 }, 90);
    const img = decode(Buffer.from(b64, 'base64'), { useTArray: true });
    expect([img.width, img.height]).toEqual([8, 8]);
    expect(Math.abs(img.data[0] - 200)).toBeLessThan(12);
    expect(Math.abs(img.data[1] - 40)).toBeLessThan(12);
  });

  it('works without Node\'s Buffer, as on the phone, and leaves no Buffer behind', () => {
    const g = globalThis as { Buffer?: unknown };
    const real = g.Buffer;
    delete g.Buffer;
    try {
      const b64 = rgbToJpegBase64(new Uint8Array(8 * 8 * 3).fill(90), 8, { x: 0, y: 0, width: 8, height: 8 });
      expect(b64.startsWith('/9j/')).toBe(true);
      expect(typeof g.Buffer).toBe('undefined');
    } finally {
      g.Buffer = real;
    }
  });

  it('writes standard base64', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'GuideAI!']) {
      expect(toBase64(new Uint8Array(Buffer.from(s)))).toBe(Buffer.from(s).toString('base64'));
    }
  });
});
