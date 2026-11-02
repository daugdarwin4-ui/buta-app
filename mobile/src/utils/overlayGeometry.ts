import type { BoundingBox } from '../types/detection.types';

export interface Size {
  width: number;
  height: number;
}

export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a detection box (0–1 of the camera frame) lands on a camera preview that fills its view
 * in "cover" mode: the frame is scaled until it covers the whole view and the overflow is cropped
 * equally on both sides. Returns null when the box is entirely in the cropped-away part.
 */
export function frameBoxToView(bbox: BoundingBox, frame: Size, view: Size): ScreenBox | null {
  if (frame.width <= 0 || frame.height <= 0 || view.width <= 0 || view.height <= 0) return null;
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const shownWidth = frame.width * scale;
  const shownHeight = frame.height * scale;
  const offsetX = (view.width - shownWidth) / 2;
  const offsetY = (view.height - shownHeight) / 2;

  const left = Math.max(0, offsetX + bbox.x * shownWidth);
  const top = Math.max(0, offsetY + bbox.y * shownHeight);
  const right = Math.min(view.width, offsetX + (bbox.x + bbox.width) * shownWidth);
  const bottom = Math.min(view.height, offsetY + (bbox.y + bbox.height) * shownHeight);
  if (right - left < 4 || bottom - top < 4) return null;
  return { left, top, width: right - left, height: bottom - top };
}
