/**
 * Camera frame → YOLO input image.
 *
 * Runs on the camera thread (a worklet), so it must stay self-contained:
 * no imports used inside, no closures over non-serializable values.
 */

/** Pixel layouts the camera can deliver when asked for 'rgb' frames */
export type RgbFrameFormat = 'rgb-bgra-8-bit' | 'rgb-rgba-8-bit' | 'rgb-rgb-8-bit';

export interface LetterboxGeometry {
  /** Size of the frame inside the square, in model pixels */
  innerWidth: number;
  innerHeight: number;
  /** Padding before the frame (left / top), in model pixels */
  padX: number;
  padY: number;
}

/**
 * Where a width×height frame lands inside the size×size model input when fitted without
 * stretching. frameToRgb repeats this math inline (worklets cannot call ordinary functions),
 * so keep the two in sync.
 */
export function letterboxGeometry(width: number, height: number, size: number): LetterboxGeometry {
  const scale = Math.min(size / width, size / height);
  const innerWidth = Math.round(width * scale);
  const innerHeight = Math.round(height * scale);
  return {
    innerWidth,
    innerHeight,
    padX: Math.floor((size - innerWidth) / 2),
    padY: Math.floor((size - innerHeight) / 2),
  };
}

/**
 * Downsample a camera frame to a size×size RGB image (3 bytes per pixel, row-major).
 *
 * The frame is "letterboxed": scaled to fit without stretching and padded with gray, exactly
 * like YOLO's training images. Stretching a 4:3 frame into a square would show the model
 * squashed objects it never learned. The whole frame stays visible (no cropping), so obstacles
 * at the far left/right are still seen; detections are mapped back with toFrameCoordinates().
 * Light smoothing (2×2 samples per pixel) keeps it fast enough for a JS worklet at a few frames per second.
 *
 * Returns null for pixel formats it does not understand (e.g. planar YUV).
 */
export function frameToRgb(
  src: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  format: string,
  size: number
): Uint8Array | null {
  'worklet';
  let bpp: number;
  let rOff: number;
  let gOff: number;
  let bOff: number;
  if (format === 'rgb-bgra-8-bit') {
    bpp = 4; rOff = 2; gOff = 1; bOff = 0;
  } else if (format === 'rgb-rgba-8-bit') {
    bpp = 4; rOff = 0; gOff = 1; bOff = 2;
  } else if (format === 'rgb-rgb-8-bit') {
    bpp = 3; rOff = 0; gOff = 1; bOff = 2;
  } else {
    return null;
  }

  // Same as letterboxGeometry()
  const scale = Math.min(size / width, size / height);
  const innerWidth = Math.round(width * scale);
  const innerHeight = Math.round(height * scale);
  const padX = Math.floor((size - innerWidth) / 2);
  const padY = Math.floor((size - innerHeight) / 2);

  const stride = bytesPerRow > 0 ? bytesPerRow : width * bpp;
  const out = new Uint8Array(size * size * 3).fill(114); // Ultralytics' padding gray, as in training

  // Each output pixel averages 2×2 samples spread over the camera pixels it covers.
  // Plain nearest-neighbour shrinking (~3×) aliases edges, which measurably lowered the model's
  // confidence and caused class mix-ups (bus seen as truck) on test photos.
  const colA = new Int32Array(innerWidth);
  const colB = new Int32Array(innerWidth);
  for (let x = 0; x < innerWidth; x++) {
    colA[x] = Math.min(width - 1, Math.floor((x + 0.25) / scale)) * bpp;
    colB[x] = Math.min(width - 1, Math.floor((x + 0.75) / scale)) * bpp;
  }

  for (let y = 0; y < innerHeight; y++) {
    const rowA = Math.min(height - 1, Math.floor((y + 0.25) / scale)) * stride;
    const rowB = Math.min(height - 1, Math.floor((y + 0.75) / scale)) * stride;
    let o = ((y + padY) * size + padX) * 3;
    for (let x = 0; x < innerWidth; x++) {
      const p1 = rowA + colA[x];
      const p2 = rowA + colB[x];
      const p3 = rowB + colA[x];
      const p4 = rowB + colB[x];
      out[o++] = (src[p1 + rOff] + src[p2 + rOff] + src[p3 + rOff] + src[p4 + rOff] + 2) >> 2;
      out[o++] = (src[p1 + gOff] + src[p2 + gOff] + src[p3 + gOff] + src[p4 + gOff] + 2) >> 2;
      out[o++] = (src[p1 + bOff] + src[p2 + bOff] + src[p3 + bOff] + src[p4 + bOff] + 2) >> 2;
    }
  }
  return out;
}

/** 0–255 RGB bytes → 0–1 float32, the input YOLO models are exported with */
export function rgbToFloat32(rgb: Uint8Array): Float32Array {
  const f = new Float32Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) f[i] = rgb[i] / 255;
  return f;
}
