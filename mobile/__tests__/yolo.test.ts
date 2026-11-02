/**
 * Unit Tests — YOLO pre-processing (camera frame → model input) and post-processing (output → detections)
 */
import { frameToRgb, letterboxGeometry, rgbToFloat32 } from '../src/services/detection/yolo/yoloPreprocess';
import { decodeYoloOutput, iou, toFrameCoordinates } from '../src/services/detection/yolo/yoloPostprocess';
import { YOLO_LABELS } from '../src/services/detection/yolo/yoloLabels';

describe('frameToRgb', () => {
  // 4x2 BGRA frame: left half red, right half blue
  const bgra = (r: number, g: number, b: number) => [b, g, r, 255];
  const red = bgra(255, 0, 0);
  const blue = bgra(0, 0, 255);
  const frame = new Uint8Array([...red, ...red, ...blue, ...blue, ...red, ...red, ...blue, ...blue]);

  it('converts BGRA to RGB and keeps left on the left', () => {
    const out = frameToRgb(frame, 4, 2, 16, 'rgb-bgra-8-bit', 2)!;
    // 4×2 frame fitted into 2×2 without stretching: one image row, then gray padding
    expect(Array.from(out)).toEqual([255, 0, 0, 0, 0, 255, 114, 114, 114, 114, 114, 114]);
  });

  it('letterboxes a portrait frame: centered, gray bars left and right, not stretched', () => {
    // 2 wide × 4 tall, all red → 4×4 input: 2 red columns in the middle
    const tall = new Uint8Array(Array(8).fill(red).flat());
    const out = frameToRgb(tall, 2, 4, 8, 'rgb-bgra-8-bit', 4)!;
    const row = Array.from(out.slice(0, 12));
    expect(row).toEqual([114, 114, 114, 255, 0, 0, 255, 0, 0, 114, 114, 114]);
    expect(letterboxGeometry(2, 4, 4)).toEqual({ innerWidth: 2, innerHeight: 4, padX: 1, padY: 0 });
  });

  it('respects row padding (bytesPerRow larger than width × 4)', () => {
    const padded = new Uint8Array([...red, ...blue, 9, 9, 9, 9, ...blue, ...red, 9, 9, 9, 9]);
    const out = frameToRgb(padded, 2, 2, 12, 'rgb-bgra-8-bit', 2)!;
    expect(Array.from(out)).toEqual([255, 0, 0, 0, 0, 255, 0, 0, 255, 255, 0, 0]);
  });

  it('handles RGBA and packed RGB frames', () => {
    expect(Array.from(frameToRgb(new Uint8Array([10, 20, 30, 255]), 1, 1, 4, 'rgb-rgba-8-bit', 1)!)).toEqual([10, 20, 30]);
    expect(Array.from(frameToRgb(new Uint8Array([10, 20, 30]), 1, 1, 3, 'rgb-rgb-8-bit', 1)!)).toEqual([10, 20, 30]);
  });

  it('refuses formats it cannot read (e.g. YUV)', () => {
    expect(frameToRgb(new Uint8Array(16), 2, 2, 8, 'yuv-420-8-bit-video', 2)).toBeNull();
  });

  it('normalizes bytes to 0–1 floats', () => {
    const f = rgbToFloat32(new Uint8Array([0, 255, 51]));
    expect(f[0]).toBe(0);
    expect(f[1]).toBe(1);
    expect(f[2]).toBeCloseTo(0.2); // float32 cannot store 0.2 exactly
  });
});

describe('decodeYoloOutput', () => {
  const C = 84; // 4 box values + 80 classes
  const N = 3;  // candidate boxes

  /** Build a channels-first [1, 84, N] output from per-anchor boxes and (class, score) */
  function makeOutput(anchors: { box: number[]; cls: number; score: number }[]) {
    const out = new Float32Array(C * N);
    anchors.forEach((a, i) => {
      a.box.forEach((v, c) => (out[c * N + i] = v));
      out[(4 + a.cls) * N + i] = a.score;
    });
    return out;
  }

  const opts = { shape: [1, C, N], inputSize: 320, labels: YOLO_LABELS, confidenceThreshold: 0.45 };

  it('decodes normalized boxes (Ultralytics TFLite export)', () => {
    const out = makeOutput([{ box: [0.5, 0.5, 0.2, 0.4], cls: 2, score: 0.9 }]);
    const [d] = decodeYoloOutput(out, opts);
    expect(d.label).toBe('car');
    expect(d.bbox.x).toBeCloseTo(0.4);
    expect(d.bbox.y).toBeCloseTo(0.3);
    expect(d.bbox.width).toBeCloseTo(0.2);
    expect(d.bbox.height).toBeCloseTo(0.4);
  });

  it('decodes pixel boxes (model converted from ONNX)', () => {
    const out = makeOutput([{ box: [160, 160, 64, 128], cls: 0, score: 0.8 }]);
    const [d] = decodeYoloOutput(out, opts);
    expect(d.label).toBe('person');
    expect(d.bbox.x).toBeCloseTo(0.4);
    expect(d.bbox.height).toBeCloseTo(0.4);
  });

  it('decodes the transposed [1, N, 84] layout', () => {
    const cf = makeOutput([{ box: [0.5, 0.5, 0.2, 0.4], cls: 5, score: 0.9 }]);
    const t = new Float32Array(C * N);
    for (let c = 0; c < C; c++) for (let a = 0; a < N; a++) t[a * C + c] = cf[c * N + a];
    const [d] = decodeYoloOutput(t, { ...opts, shape: [1, N, C] });
    expect(d.label).toBe('bus');
  });

  it('drops low-confidence boxes and merges duplicates of the same object', () => {
    const out = makeOutput([
      { box: [0.5, 0.5, 0.2, 0.4], cls: 2, score: 0.9 },
      { box: [0.51, 0.5, 0.2, 0.4], cls: 2, score: 0.7 }, // same car, overlapping
      { box: [0.1, 0.1, 0.1, 0.1], cls: 0, score: 0.2 },  // too weak
    ]);
    const res = decodeYoloOutput(out, opts);
    expect(res).toHaveLength(1);
    expect(res[0].confidence).toBeCloseTo(0.9);
  });

  it('keeps overlapping boxes of different classes (person on a motorcycle)', () => {
    const out = makeOutput([
      { box: [0.5, 0.5, 0.2, 0.4], cls: 3, score: 0.9 },
      { box: [0.5, 0.5, 0.2, 0.4], cls: 0, score: 0.8 },
    ]);
    expect(decodeYoloOutput(out, opts).map((d) => d.label).sort()).toEqual(['motorcycle', 'person']);
  });

  it('computes intersection over union', () => {
    expect(iou({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 })).toBe(1);
    expect(iou({ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.5, y: 0, width: 0.5, height: 1 })).toBe(0);
  });
});

describe('toFrameCoordinates', () => {
  // A 480×640 portrait frame in a 320 input: 240 px wide image, 40 px gray bars left and right
  const det = (x: number, y: number, width: number, height: number) => ({
    classId: 0, label: 'person', confidence: 0.9, bbox: { x, y, width, height },
  });

  it('maps boxes from the padded square back to the camera frame', () => {
    const [out] = toFrameCoordinates([det(40 / 320, 0, 120 / 320, 160 / 320)], 480, 640, 320);
    expect(out.bbox.x).toBeCloseTo(0);
    expect(out.bbox.width).toBeCloseTo(0.5);
    expect(out.bbox.y).toBeCloseTo(0);
    expect(out.bbox.height).toBeCloseTo(0.5);
  });

  it('drops boxes that lie entirely in the padding', () => {
    expect(toFrameCoordinates([det(0, 0.2, 30 / 320, 0.2)], 480, 640, 320)).toHaveLength(0);
  });
});
