/**
 * An unsure box covering nearly the whole picture is almost always the model guessing at a
 * featureless view (a wall, a table top, a dim scene), not a real object filling the lens.
 * (Seen on the phone: lying face down, it reported "open drain, very close" at 29–36%.)
 */
const FULL_FRAME_AREA = 0.8;
const FULL_FRAME_MAX_CONFIDENCE = 0.5;

export function isFullFrameGuess(d: { confidence: number; bbox: { width: number; height: number } }): boolean {
  return d.confidence < FULL_FRAME_MAX_CONFIDENCE && d.bbox.width * d.bbox.height > FULL_FRAME_AREA;
}
