/**
 * Unit Tests — "Improve My AI" picture collection: when to save, picture format, suggestions
 */
import { encodeBmp } from '../src/utils/bmp';
import {
  MAX_SAMPLES,
  PERIODIC_GAP_MS,
  UNSURE_GAP_MS,
  sampleName,
  sampleReason,
  suggestionsJson,
} from '../src/services/training/sampleCollector';

describe('sampleReason', () => {
  const base = { now: 100_000, lastSavedAt: 0, unsureCount: 0, stored: 0 };

  it('saves a picture when the model was unsure, at most every few seconds', () => {
    expect(sampleReason({ ...base, unsureCount: 1, lastSavedAt: base.now - UNSURE_GAP_MS })).toBe('unsure');
    expect(sampleReason({ ...base, unsureCount: 1, lastSavedAt: base.now - UNSURE_GAP_MS + 1 })).toBeNull();
  });

  it('also saves one picture a minute when nothing was unsure, to catch missed obstacles', () => {
    expect(sampleReason({ ...base, lastSavedAt: base.now - PERIODIC_GAP_MS })).toBe('periodic');
    expect(sampleReason({ ...base, lastSavedAt: base.now - PERIODIC_GAP_MS + 1 })).toBeNull();
  });

  it('stops when the phone already holds the maximum', () => {
    expect(sampleReason({ ...base, unsureCount: 3, stored: MAX_SAMPLES })).toBeNull();
  });
});

describe('encodeBmp', () => {
  it('writes a valid 24-bit BMP of the chosen part of the image, bottom row first, in BGR', () => {
    // 3×2 image; crop the 2×2 on the right
    const rgb = new Uint8Array([
      1, 2, 3, 10, 20, 30, 40, 50, 60,
      7, 8, 9, 70, 80, 90, 100, 110, 120,
    ]);
    const bmp = encodeBmp(rgb, 3, { x: 1, y: 0, width: 2, height: 2 });
    const view = new DataView(bmp.buffer);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe('BM');
    expect(view.getUint32(2, true)).toBe(bmp.length);
    expect(view.getInt32(18, true)).toBe(2);
    expect(view.getInt32(22, true)).toBe(2);
    expect(view.getUint16(28, true)).toBe(24);
    // Each row is 6 bytes padded to 8; the bottom row (70,80,90 | 100,110,120) comes first
    expect(bmp.length).toBe(54 + 8 * 2);
    expect(Array.from(bmp.slice(54, 60))).toEqual([90, 80, 70, 120, 110, 100]);
    expect(Array.from(bmp.slice(62, 68))).toEqual([30, 20, 10, 60, 50, 40]);
  });
});

describe('saved files', () => {
  it('names pictures by time and reason so they sort in order', () => {
    expect(sampleName(new Date(2026, 9, 14, 9, 5, 7), 'unsure')).toBe('gai_20261014_090507_unsure');
  });

  it('stores the model guesses as unverified suggestions in YOLO box format', () => {
    const json = JSON.parse(
      suggestionsJson('unsure', 240, 320, [
        { classId: 2, label: 'motorcycle', confidence: 0.2768, bbox: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 }, reported: false },
      ])
    );
    expect(json.note).toMatch(/NOT verified/);
    expect(json.width).toBe(240);
    expect(json.suggestions[0]).toEqual({
      label: 'motorcycle',
      confidence: 0.277,
      reported: false,
      x_center: 0.30000000000000004,
      y_center: 0.45,
      width: 0.4,
      height: 0.5,
    });
  });
});
