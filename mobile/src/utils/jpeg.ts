import { encode } from 'jpeg-js';
import type { PixelRect } from './bmp';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 of raw bytes (no "data:" prefix) */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += BASE64[n >> 18] + BASE64[(n >> 12) & 63] + BASE64[(n >> 6) & 63] + BASE64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += BASE64[n >> 18] + BASE64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += BASE64[n >> 18] + BASE64[(n >> 12) & 63] + BASE64[(n >> 6) & 63] + '=';
  }
  return out;
}

/**
 * JPEG (base64) of `rect` cut from an RGB image (3 bytes per pixel, `srcWidth` pixels wide).
 * Pure JavaScript, so it ships in an over-the-air update without a new APK.
 */
export function rgbToJpegBase64(rgb: Uint8Array, srcWidth: number, rect: PixelRect, quality = 70): string {
  const { x, y, width, height } = rect;
  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    let s = ((y + row) * srcWidth + x) * 3;
    let o = row * width * 4;
    for (let col = 0; col < width; col++, s += 3) {
      rgba[o++] = rgb[s];
      rgba[o++] = rgb[s + 1];
      rgba[o++] = rgb[s + 2];
      rgba[o++] = 255;
    }
  }
  // jpeg-js returns its result through Node's Buffer, which React Native does not have:
  // lend it a minimal stand-in just for this call
  const g = globalThis as { Buffer?: unknown };
  const lent = typeof g.Buffer === 'undefined';
  if (lent) g.Buffer = { from: (data: ArrayLike<number>) => Uint8Array.from(data) };
  try {
    const { data } = encode({ data: rgba, width, height }, quality);
    return toBase64(new Uint8Array(data));
  } finally {
    if (lent) delete g.Buffer;
  }
}
