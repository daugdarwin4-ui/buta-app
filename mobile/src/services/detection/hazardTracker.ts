import type { BoundingBox, RawDetection } from '../../types/detection.types';
import { iou } from './yolo/yoloPostprocess';

/**
 * Follows each detected object from one camera frame to the next (~3 frames per second).
 *
 * - Confirmation: an object must be seen in CONFIRM_HITS of the last HISTORY frames before it is
 *   reported, which removes most one-frame false alarms. Very confident detections skip the wait,
 *   except classes in STRICT_CONFIRMATION (stairs), which always need steadier evidence.
 * - Coasting: a confirmed object missed for one frame is still reported, so alerts don't flicker.
 * - Approaching: if an object's box grew clearly over the last second, it is getting closer.
 * - Low-confidence rescue (the ByteTrack idea): detections too unsure to report on their own may
 *   still keep an already-known object alive, e.g. a motorcycle partly hidden behind a person.
 *   They never create new objects, so they cannot add false alarms.
 * - Smoothing: reported boxes are averaged over frames, so the distance band doesn't jitter.
 */

const HISTORY = 3;
const CONFIRM_HITS = 2;
/** Confident enough to report from the first frame (dangerous objects shouldn't wait) */
const INSTANT_CONFIDENCE = 0.75;

/**
 * Classes that need steadier evidence. The model calls repeating horizontal lines (wall siding,
 * shelves, tiles, blinds) "stairs", sometimes with high confidence, so stairs must be seen in 3 of the
 * last 4 frames (about 1.2 s) and never skip the wait. Real stairs stay in view as the user walks up.
 */
const STRICT_CONFIRMATION: Record<string, { history: number; hits: number }> = {
  stairs: { history: 4, hits: 3 },
};

function confirmationRule(label: string): { history: number; hits: number; instant: boolean } {
  const strict = STRICT_CONFIRMATION[label];
  return strict ? { ...strict, instant: false } : { history: HISTORY, hits: CONFIRM_HITS, instant: true };
}

/** Confirmed from the first frame: very confident, and not a class that needs steadier evidence */
function instantlyConfirmed(det: RawDetection): boolean {
  return confirmationRule(det.label).instant && det.confidence >= INSTANT_CONFIDENCE;
}
/** Frames an object may be missed before it is dropped */
const MAX_MISSED = 1;
/** Minimum overlap to count as the same object in the next frame */
const MIN_IOU = 0.15;
/** Box centers this close (fraction of the frame) still match, for fast movers with no overlap */
const MAX_CENTER_JUMP = 0.15;

/** Box-height growth over APPROACH_WINDOW_MS that means "coming closer" (and to keep saying so) */
const APPROACH_GROWTH = 1.15;
const APPROACH_KEEP_GROWTH = 1.05;
const APPROACH_WINDOW_MS = 1200;
/** Need at least this much history to judge growth */
const APPROACH_MIN_SPAN_MS = 500;
/** Low-confidence detections must overlap a known object at least this much to rescue it */
const LOW_MIN_IOU = 0.3;
/** Weight of the newest box in the smoothed box (1 = no smoothing) */
const SMOOTHING = 0.6;

function smoothBox(prev: BoundingBox, next: BoundingBox): BoundingBox {
  const mix = (a: number, b: number) => a + (b - a) * SMOOTHING;
  return {
    x: mix(prev.x, next.x),
    y: mix(prev.y, next.y),
    width: mix(prev.width, next.width),
    height: mix(prev.height, next.height),
  };
}

export interface TrackedDetection extends RawDetection {
  trackId: number;
  approaching: boolean;
}

interface Track {
  id: number;
  label: string;
  classId: number;
  bbox: BoundingBox;
  confidence: number;
  /** 1 = seen, 0 = missed, newest last */
  hits: number[];
  missed: number;
  confirmed: boolean;
  approaching: boolean;
  heights: { t: number; h: number }[];
}

function centerDistance(a: BoundingBox, b: BoundingBox): number {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2);
  const dy = a.y + a.height / 2 - (b.y + b.height / 2);
  return Math.hypot(dx, dy);
}

function matchScore(track: Track, det: RawDetection): number {
  if (track.label !== det.label) return 0;
  const overlap = iou(track.bbox, det.bbox);
  if (overlap >= MIN_IOU) return overlap;
  // Small positive score so overlapping matches always win over center-distance ones
  return centerDistance(track.bbox, det.bbox) <= MAX_CENTER_JUMP ? 0.01 : 0;
}

export class HazardTracker {
  private tracks: Track[] = [];
  private nextId = 1;

  reset() {
    this.tracks = [];
  }

  /**
   * Feed one frame's detections; returns the confirmed objects to report for this frame.
   * `lowConfidence`: detections below the reporting threshold, used only to keep known objects.
   */
  update(detections: RawDetection[], now = Date.now(), lowConfidence: RawDetection[] = []): TrackedDetection[] {
    const trackUsed = new Set<number>();

    // Stage 1: confident detections, greedy matching, best pairs first
    const detUsed = this.associate(detections, trackUsed, (track, det) => matchScore(track, det));
    detUsed.forEach((t, d) => {
      const det = detections[d];
      this.applyMatch(this.tracks[t], det, now);
      if (instantlyConfirmed(det)) this.tracks[t].confirmed = true;
    });

    // Stage 2: still-unmatched known objects may be kept by a well-overlapping unsure detection
    // (not for strict classes: a confirmed false "stairs" on a floor was kept alive by 0.24 guesses)
    const lowUsed = this.associate(lowConfidence, trackUsed, (track, det) => {
      if (track.label !== det.label || STRICT_CONFIRMATION[track.label]) return 0;
      const overlap = iou(track.bbox, det.bbox);
      return overlap >= LOW_MIN_IOU ? overlap : 0;
    });
    lowUsed.forEach((t, d) => this.applyMatch(this.tracks[t], lowConfidence[d], now));

    this.tracks.forEach((track, t) => {
      if (trackUsed.has(t)) return;
      track.missed++;
      this.pushHit(track, 0);
    });
    this.tracks = this.tracks.filter((track) => track.missed <= MAX_MISSED);

    detections.forEach((det, d) => {
      if (detUsed.has(d)) return;
      this.tracks.push({
        id: this.nextId++,
        label: det.label,
        classId: det.classId,
        bbox: det.bbox,
        confidence: det.confidence,
        hits: [1],
        missed: 0,
        confirmed: instantlyConfirmed(det),
        approaching: false,
        heights: [{ t: now, h: det.bbox.height }],
      });
    });

    return this.tracks
      .filter((track) => track.confirmed)
      .map((track) => ({
        classId: track.classId,
        label: track.label,
        confidence: track.confidence,
        bbox: track.bbox,
        trackId: track.id,
        approaching: track.approaching,
      }));
  }

  /**
   * Greedy one-to-one matching of detections to tracks not yet in `trackUsed` (which it extends).
   * Returns detection index → track index.
   */
  private associate(
    detections: RawDetection[],
    trackUsed: Set<number>,
    score: (track: Track, det: RawDetection) => number
  ): Map<number, number> {
    const pairs: { t: number; d: number; score: number }[] = [];
    this.tracks.forEach((track, t) => {
      if (trackUsed.has(t)) return;
      detections.forEach((det, d) => {
        const s = score(track, det);
        if (s > 0) pairs.push({ t, d, score: s });
      });
    });
    pairs.sort((a, b) => b.score - a.score);

    const matched = new Map<number, number>();
    for (const { t, d } of pairs) {
      if (trackUsed.has(t) || matched.has(d)) continue;
      trackUsed.add(t);
      matched.set(d, t);
    }
    return matched;
  }

  private applyMatch(track: Track, det: RawDetection, now: number) {
    track.bbox = smoothBox(track.bbox, det.bbox);
    track.confidence = det.confidence;
    track.classId = det.classId;
    track.missed = 0;
    this.pushHit(track, 1);
    // Raw height: smoothing would delay noticing that something is coming closer
    this.recordHeight(track, det.bbox.height, now);
  }

  private pushHit(track: Track, hit: number) {
    track.hits.push(hit);
    const rule = confirmationRule(track.label);
    if (track.hits.length > rule.history) track.hits.shift();
    if (track.hits.reduce((a, b) => a + b, 0) >= rule.hits) track.confirmed = true;
  }

  private recordHeight(track: Track, h: number, now: number) {
    track.heights.push({ t: now, h });
    track.heights = track.heights.filter((s) => now - s.t <= APPROACH_WINDOW_MS);
    const oldest = track.heights[0];
    if (now - oldest.t < APPROACH_MIN_SPAN_MS || oldest.h <= 0) {
      track.approaching = false;
      return;
    }
    const growth = h / oldest.h;
    // Hysteresis: harder to start "approaching" than to keep it, so it doesn't flip every frame
    track.approaching = growth >= (track.approaching ? APPROACH_KEEP_GROWTH : APPROACH_GROWTH);
  }
}
