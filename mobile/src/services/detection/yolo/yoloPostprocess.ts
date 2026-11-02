import type { BoundingBox, RawDetection } from '../../../types/detection.types';
import { letterboxGeometry } from './yoloPreprocess';

export interface DecodeOptions {
  /** Model output shape, e.g. [1, 84, 2100] (Ultralytics) or [1, 2100, 84] (transposed) */
  shape: number[];
  /** Square input size the model ran at, e.g. 320 */
  inputSize: number;
  labels: string[];
  confidenceThreshold: number;
  iouThreshold?: number;
  maxDetections?: number;
}

/**
 * Decode a YOLOv8/YOLO11 detection output into normalized (0–1) detections, with NMS.
 *
 * Each candidate has 4 box values (center x, center y, width, height) followed by one score per
 * class. Handles both layouts ([1, 4+C, N] and [1, N, 4+C]) and both box units: models exported
 * by Ultralytics to TFLite use 0–1, models converted from ONNX use pixels of the input size.
 */
export function decodeYoloOutput(output: Float32Array, opts: DecodeOptions): RawDetection[] {
  const { shape, inputSize, labels, confidenceThreshold } = opts;
  const [, d1, d2] = shape;
  // The 4+classes dimension is identified by the label count; fall back to "the smaller one"
  const expected = labels.length + 4;
  const channelsFirst = d1 === expected ? true : d2 === expected ? false : d1 < d2;
  const channels = channelsFirst ? d1 : d2;
  const anchors = channelsFirst ? d2 : d1;
  const numClasses = channels - 4;
  const at = channelsFirst
    ? (c: number, a: number) => output[c * anchors + a]
    : (c: number, a: number) => output[a * channels + c];

  // Pixel units if any box coordinate is clearly bigger than 1
  let scale = 1;
  for (let a = 0; a < anchors; a++) {
    if (at(2, a) > 2 || at(3, a) > 2) {
      scale = 1 / inputSize;
      break;
    }
  }

  const candidates: RawDetection[] = [];
  for (let a = 0; a < anchors; a++) {
    let best = 0;
    let bestClass = -1;
    for (let c = 0; c < numClasses; c++) {
      const s = at(4 + c, a);
      if (s > best) {
        best = s;
        bestClass = c;
      }
    }
    if (best < confidenceThreshold) continue;

    const cx = at(0, a) * scale;
    const cy = at(1, a) * scale;
    const w = at(2, a) * scale;
    const h = at(3, a) * scale;
    const x = clamp01(cx - w / 2);
    const y = clamp01(cy - h / 2);
    candidates.push({
      classId: bestClass,
      label: labels[bestClass] ?? `class_${bestClass}`,
      confidence: best,
      bbox: { x, y, width: clamp01(cx + w / 2) - x, height: clamp01(cy + h / 2) - y },
    });
  }

  return nonMaxSuppression(candidates, opts.iouThreshold ?? 0.45, opts.maxDetections ?? 20);
}

/** Keep the most confident box among heavily overlapping boxes of the same class */
export function nonMaxSuppression(boxes: RawDetection[], iouThreshold: number, max: number): RawDetection[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: RawDetection[] = [];
  for (const box of sorted) {
    if (kept.length >= max) break;
    if (!kept.some((k) => k.classId === box.classId && iou(k.bbox, box.bbox) > iouThreshold)) {
      kept.push(box);
    }
  }
  return kept;
}

export function iou(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Map detections from the letterboxed model input (0–1 of the square) back to the camera frame
 * (0–1 of its width and height). Boxes that fall entirely in the padding are dropped.
 */
export function toFrameCoordinates(
  detections: RawDetection[],
  frameWidth: number,
  frameHeight: number,
  inputSize: number
): RawDetection[] {
  const { innerWidth, innerHeight, padX, padY } = letterboxGeometry(frameWidth, frameHeight, inputSize);
  const out: RawDetection[] = [];
  for (const det of detections) {
    const x1 = clamp01((det.bbox.x * inputSize - padX) / innerWidth);
    const y1 = clamp01((det.bbox.y * inputSize - padY) / innerHeight);
    const x2 = clamp01(((det.bbox.x + det.bbox.width) * inputSize - padX) / innerWidth);
    const y2 = clamp01(((det.bbox.y + det.bbox.height) * inputSize - padY) / innerHeight);
    if (x2 - x1 <= 0 || y2 - y1 <= 0) continue;
    out.push({ ...det, bbox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } });
  }
  return out;
}
