/** Part of an image, in pixels */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A 24-bit BMP file of `rect` cut from an RGB image (3 bytes per pixel, `srcWidth` pixels wide).
 * BMP needs no compression code, and every labelling and training tool reads it.
 */
export function encodeBmp(rgb: Uint8Array, srcWidth: number, rect: PixelRect): Uint8Array {
  const { x: left, y: top, width, height } = rect;
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows are padded to 4 bytes
  const dataSize = rowSize * height;
  const headerSize = 14 + 40;
  const out = new Uint8Array(headerSize + dataSize);
  const view = new DataView(out.buffer);

  // File header
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, out.length, true);
  view.setUint32(10, headerSize, true);
  // Info header
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = rows stored bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(34, dataSize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);

  for (let row = 0; row < height; row++) {
    const srcRow = top + height - 1 - row;
    let o = headerSize + row * rowSize;
    let s = (srcRow * srcWidth + left) * 3;
    for (let col = 0; col < width; col++, s += 3) {
      out[o++] = rgb[s + 2]; // BMP stores blue, green, red
      out[o++] = rgb[s + 1];
      out[o++] = rgb[s];
    }
  }
  return out;
}
