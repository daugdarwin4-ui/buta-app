import { letterboxGeometry } from './yoloPreprocess';

/**
 * Can the camera actually see? No detections from a dark or covered camera must never be
 * reported as "path clear" to a blind user.
 *
 *  - 'dark':    too little light to see obstacles (night without street lights, lens covered,
 *               phone in a pocket or bag)
 *  - 'blocked': the view is one flat colour (finger or object right on the lens, or something
 *               very close filling the whole view)
 */
export type CameraView = 'ok' | 'dark' | 'blocked';

/** Average brightness (0–255) below this: too dark to see obstacles */
const DARK_MEAN = 28;
/** Brightness spread below this: no detail at all, nothing can be recognised */
const FLAT_STD = 7;
/** Every Nth pixel in each direction is enough to judge the whole view */
const STEP = 4;

/**
 * Judge the camera view from the letterboxed model input (size×size RGB, 3 bytes per pixel)
 * made from a frameWidth×frameHeight camera frame. The gray letterbox padding is ignored.
 */
export function assessView(rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number): CameraView {
  const { innerWidth, innerHeight, padX, padY } = letterboxGeometry(frameWidth, frameHeight, size);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = padY; y < padY + innerHeight; y += STEP) {
    for (let x = padX; x < padX + innerWidth; x += STEP) {
      const i = (y * size + x) * 3;
      // Perceived brightness (ITU-R BT.601)
      const l = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  if (n === 0) return 'ok';
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  if (mean < DARK_MEAN) return 'dark';
  if (std < FLAT_STD) return 'blocked';
  return 'ok';
}

/** Spoken and shown when the camera cannot see */
export const CAMERA_VIEW_MESSAGES: Record<Exclude<CameraView, 'ok'>, string> = {
  dark: 'Camera view is too dark or covered. Obstacles cannot be detected.',
  blocked: 'Camera view is blocked. Something may be very close, or the lens is covered.',
};

/**
 * Smooths the per-frame verdict: the view only changes after CONFIRM_FRAMES frames in a row
 * agree (~1 s at 3 frames per second), so a passing shadow does not trigger a warning.
 */
export class CameraViewMonitor {
  private current: CameraView = 'ok';
  private candidate: CameraView = 'ok';
  private streak = 0;

  constructor(private readonly confirmFrames = 3) {}

  get view(): CameraView {
    return this.current;
  }

  /** Feed one frame's verdict; returns the new view when it changed, otherwise null */
  update(next: CameraView): CameraView | null {
    if (next === this.current) {
      this.candidate = next;
      this.streak = 0;
      return null;
    }
    if (next === this.candidate) {
      this.streak++;
    } else {
      this.candidate = next;
      this.streak = 1;
    }
    if (this.streak < this.confirmFrames) return null;
    this.current = next;
    this.streak = 0;
    return next;
  }

  /** Back to 'ok' (camera stopped); returns true if that is a change */
  reset(): boolean {
    const changed = this.current !== 'ok';
    this.current = 'ok';
    this.candidate = 'ok';
    this.streak = 0;
    return changed;
  }
}
