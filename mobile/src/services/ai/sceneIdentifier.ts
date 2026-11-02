import type { BoundingBox, DetectedHazard } from '../../types/detection.types';
import { iou } from '../detection/yolo/yoloPostprocess';
import { letterboxGeometry } from '../detection/yolo/yoloPreprocess';
import { rgbToJpegBase64 } from '../../utils/jpeg';
import type { Certainty, IdentifiedObject, KnownBox } from './gemini.service';

/**
 * AI object identification on top of the on-phone YOLO detector.
 *
 * YOLO stays the fast, offline, safety-critical detector (it alone triggers spoken hazard alerts).
 * Every few seconds, when online, one sharper camera picture goes to Gemini, which finds and names
 * every object it can, including ones YOLO has no class for (rice cooker, broom, ladder…):
 *  - a Gemini object overlapping a YOLO object of the same kind gives it a more specific name
 *    ("chair" → "monobloc chair"), remembered for that tracked object (no re-asking every frame);
 *  - a Gemini object YOLO has nothing for is shown as an extra "AI" object;
 *  - when they disagree (YOLO "car", Gemini "laptop") both are shown; the alert is NOT silenced,
 *    because a cloud answer must never switch off a safety warning.
 */

/** Seconds between scans while things change; backs off while the scene stays the same */
export const SCAN_INTERVAL_MS = 6000;
export const MAX_SCAN_INTERVAL_MS = 20000;
/** An AI-only object is shown at most this long after the scan that saw it */
export const EXTRA_TTL_MS = 6000;
/**
 * The camera has turned to a different view when the picture differs this much (0–1, mean
 * brightness change over an 8×8 grid). Then AI-only boxes are dropped at once (they would float
 * over the wrong things) and a new scan is started soon.
 */
export const SCENE_CHANGE = 0.12;
/** After the view changes, wait this long for the camera to settle before looking again */
const RESCAN_AFTER_CHANGE_MS = 1500;
const GRID = 8;

/**
 * Coarse brightness layout of the real picture inside a letterboxed RGB image: 8×8 cell averages
 * (0–1). Cheap enough for every analysed frame.
 */
export function viewSignature(rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number): number[] {
  const { innerWidth, innerHeight, padX, padY } = letterboxGeometry(frameWidth, frameHeight, size);
  const out: number[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let n = 0;
      // Sample a 4×4 lattice inside each cell
      for (let sy = 0; sy < 4; sy++) {
        const y = padY + Math.floor(((gy + (sy + 0.5) / 4) * innerHeight) / GRID);
        for (let sx = 0; sx < 4; sx++) {
          const x = padX + Math.floor(((gx + (sx + 0.5) / 4) * innerWidth) / GRID);
          const i = (y * size + x) * 3;
          sum += (rgb[i] * 299 + rgb[i + 1] * 587 + rgb[i + 2] * 114) / 1000;
          n++;
        }
      }
      out.push(sum / n / 255);
    }
  }
  return out;
}

/** 0 = same view, larger = more different */
export function viewDifference(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 1;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
}
/** Minimum overlap to treat a Gemini box and a YOLO box as the same object */
const MATCH_IOU = 0.3;

/** Gemini names that count as the same kind of object as each YOLO class */
const SAME_KIND: Record<string, string[]> = {
  person: ['person', 'man', 'woman', 'child', 'boy', 'girl', 'people', 'pedestrian', 'student', 'vendor', 'guard', 'worker', 'cyclist', 'rider'],
  bicycle: ['bicycle', 'bike', 'e-bike', 'pedicab'],
  car: ['car', 'sedan', 'suv', 'van', 'taxi', 'vehicle'],
  motorcycle: ['motorcycle', 'motorbike', 'scooter', 'habal', 'moped'],
  tricycle: ['tricycle', 'trike', 'pedicab'],
  jeepney: ['jeepney', 'jeep'],
  bus: ['bus', 'coaster'],
  truck: ['truck', 'pickup', 'lorry', 'dump truck', 'vehicle'],
  dog: ['dog', 'puppy', 'aso'],
  cat: ['cat', 'kitten', 'iring'],
  cow: ['cow', 'carabao', 'bull', 'cattle', 'water buffalo'],
  horse: ['horse', 'pony'],
  pothole: ['pothole', 'hole', 'crack', 'depression'],
  open_drainage: ['drain', 'drainage', 'canal', 'gutter', 'manhole', 'ditch'],
  stairs: ['stairs', 'stair', 'steps', 'staircase', 'stairway'],
  pole: ['pole', 'post', 'pillar', 'column', 'lamp', 'signpost', 'electric post'],
  barrier: ['barrier', 'fence', 'railing', 'barricade', 'cone', 'gate', 'bollard'],
  bump: ['bump', 'hump', 'curb'],
  cart: ['cart', 'kariton', 'stall', 'wheelbarrow', 'trolley'],
  bench: ['bench', 'seat'],
  chair: ['chair', 'stool', 'seat', 'monobloc'],
  'fire hydrant': ['hydrant'],
  'potted plant': ['plant', 'flowerpot', 'pot', 'flower'],
  'traffic light': ['traffic light', 'signal'],
  'stop sign': ['stop sign', 'sign'],
};

/** Whether a Gemini name/category describes the same kind of object as a YOLO label */
export function sameKind(yoloLabel: string, name: string, category: string): boolean {
  const words = SAME_KIND[yoloLabel.toLowerCase()] ?? [yoloLabel.toLowerCase()];
  const text = `${name} ${category}`.toLowerCase();
  return words.some((w) => text.includes(w));
}

export interface TrackName {
  name: string;
  certainty: Certainty;
  /** Gemini sees something else here than YOLO does (shown as "AI: …", alert unchanged) */
  disagrees: boolean;
}

export interface ExtraObject {
  name: string;
  category: string;
  certainty: Certainty;
  bbox: BoundingBox;
  seenAt: number;
}

/** Combine one scan's answer with what YOLO reports at that moment */
export function mergeIdentifications(
  yolo: DetectedHazard[],
  objects: IdentifiedObject[],
  now: number
): { names: Map<number, TrackName>; extras: ExtraObject[] } {
  const names = new Map<number, TrackName>();
  const extras: ExtraObject[] = [];
  const usedTracks = new Set<number>();
  // Biggest objects first: they are the most reliable matches
  const sorted = [...objects].sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
  for (const o of sorted) {
    let best: DetectedHazard | null = null;
    let bestIou = MATCH_IOU;
    for (const d of yolo) {
      if (!d.bbox || d.trackId === undefined || usedTracks.has(d.trackId)) continue;
      const overlap = iou(d.bbox, o.bbox);
      if (overlap >= bestIou) {
        best = d;
        bestIou = overlap;
      }
    }
    if (best && best.trackId !== undefined) {
      usedTracks.add(best.trackId);
      const same = sameKind(best.label, o.name, o.category);
      // A vague answer adds nothing to a confident YOLO label of the same kind
      if (same && (o.certainty === 'low' || o.name === best.label.toLowerCase() || o.name === 'unknown object')) continue;
      names.set(best.trackId, { name: o.name, certainty: o.certainty, disagrees: !same });
    } else {
      extras.push({ name: o.name, category: o.category, certainty: o.certainty, bbox: o.bbox, seenAt: now });
    }
  }
  return { names, extras };
}

/** "rice cooker", "probably a rice cooker", "possibly a rice cooker" */
export function spokenName(name: string, certainty: Certainty): string {
  if (certainty === 'high' || name === 'unknown object') return name;
  const article = /^[aeiou]/.test(name) ? 'an' : 'a';
  return `${certainty === 'medium' ? 'probably' : 'possibly'} ${article} ${name}`;
}

export type ScanStatus = 'off' | 'waiting' | 'scanning' | 'offline';

export interface SceneIdentifierState {
  status: ScanStatus;
  /** Specific names for YOLO-tracked objects, by track id */
  names: Map<number, TrackName>;
  /** Objects only the AI found, still fresh enough to show */
  extras: ExtraObject[];
  lastScanAt: number | null;
}

export interface SceneIdentifierDeps {
  /** Ask the camera for one sharp picture (delivered to onHiResFrame) */
  requestFrame: () => void;
  identify: (base64Jpeg: string, known: KnownBox[]) => Promise<IdentifiedObject[] | null>;
  /** Whether Gemini can be used right now (key present, not rate-limited) */
  isAvailable: () => boolean;
  now?: () => number;
}

/** Schedules scans, keeps their results, and publishes them to the camera screen */
export class SceneIdentifier {
  private state: SceneIdentifierState = { status: 'off', names: new Map(), extras: [], lastScanAt: null };
  private listeners = new Set<(s: SceneIdentifierState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;
  private awaitingFrame = false;
  private generation = 0;
  private interval = SCAN_INTERVAL_MS;
  private yolo: DetectedHazard[] = [];
  private lastNames = '';
  /** What the camera saw when the current AI-only boxes (or the pending scan) were captured */
  private shownView: number[] | null = null;
  private latestView: number[] | null = null;

  constructor(private deps: SceneIdentifierDeps) {}

  private now() {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  get current(): SceneIdentifierState {
    return this.state;
  }

  subscribe(listener: (s: SceneIdentifierState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.generation++;
    this.inFlight = false;
    this.interval = SCAN_INTERVAL_MS;
    this.publish({ status: 'waiting' });
    this.schedule(1500); // first look soon after the camera opens
  }

  stop() {
    this.running = false;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.inFlight = false;
    this.awaitingFrame = false;
    this.shownView = null;
    this.latestView = null;
    this.publish({ status: 'off', names: new Map(), extras: [], lastScanAt: null });
  }

  /** Latest YOLO detections (camera only), used to match names and to spot new objects */
  setDetections(detections: DetectedHazard[]) {
    const fresh = detections.filter((d) => d.source === 'camera');
    // Something new appeared that has no AI name yet: look again soon
    const unnamedNew = fresh.some(
      (d) => d.trackId !== undefined && !this.state.names.has(d.trackId) && !this.yolo.some((y) => y.trackId === d.trackId)
    );
    this.yolo = fresh;
    if (unnamedNew && this.interval > SCAN_INTERVAL_MS) {
      this.interval = SCAN_INTERVAL_MS;
      if (this.running && !this.inFlight) this.schedule(SCAN_INTERVAL_MS / 2);
    }
    // Drop names of objects that are gone, and AI-only objects that are too old
    const alive = new Set(fresh.map((d) => d.trackId));
    const now = this.now();
    const names = new Map([...this.state.names].filter(([id]) => alive.has(id)));
    const extras = this.state.extras.filter((e) => now - e.seenAt <= EXTRA_TTL_MS);
    if (names.size !== this.state.names.size || extras.length !== this.state.extras.length) this.publish({ names, extras });
  }

  /**
   * Every analysed camera frame (the small YOLO image). Notices when the camera turns to a
   * different view: AI-only boxes from the old view are removed and a new scan comes soon.
   */
  onFrame(rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number) {
    if (!this.running) return;
    const view = viewSignature(rgb, size, frameWidth, frameHeight);
    this.latestView = view;
    if (!this.shownView || viewDifference(view, this.shownView) <= SCENE_CHANGE) return;
    this.shownView = null;
    if (this.state.extras.length) this.publish({ extras: [] });
    this.interval = SCAN_INTERVAL_MS;
    if (!this.inFlight) this.schedule(RESCAN_AFTER_CHANGE_MS);
  }

  /** The sharp picture requested by a scan (HI_RES letterboxed RGB of a frameWidth×frameHeight frame) */
  async onHiResFrame(rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number) {
    if (!this.running || !this.awaitingFrame) return;
    this.awaitingFrame = false;
    // The picture arrived: cancel the "no picture" fallback, the answer may take several seconds
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const generation = this.generation;
    try {
      // Send only the real picture, not the gray letterbox bars: boxes then match YOLO's frame coordinates
      const { innerWidth, innerHeight, padX, padY } = letterboxGeometry(frameWidth, frameHeight, size);
      const jpeg = rgbToJpegBase64(rgb, size, { x: padX, y: padY, width: innerWidth, height: innerHeight }, 70);
      // YOLO's view at the moment of the picture: the answer is matched against this, not against
      // where things are seconds later when it arrives
      const atCapture = this.yolo;
      const capturedView = viewSignature(rgb, size, frameWidth, frameHeight);
      const known: KnownBox[] = atCapture.filter((d) => d.bbox).map((d) => ({ label: d.label, bbox: d.bbox! }));
      const objects = await this.deps.identify(jpeg, known);
      // Stopped (or stopped and restarted) while waiting: this answer belongs to an old session
      if (!this.running || generation !== this.generation) return;
      if (!objects) {
        this.publish({ status: 'offline' });
      } else {
        const now = this.now();
        const { names, extras } = mergeIdentifications(atCapture, objects, now);
        // Keep earlier names for objects this scan did not mention (cache per tracked object)
        const merged = new Map(this.state.names);
        names.forEach((v, k) => merged.set(k, v));
        // The camera moved on while the answer was on its way: its AI-only boxes would point at
        // the wrong things now, so show only the names of tracked objects (YOLO follows those)
        const moved = this.latestView !== null && viewDifference(this.latestView, capturedView) > SCENE_CHANGE;
        this.shownView = moved ? null : capturedView;
        this.publish({ status: 'waiting', names: merged, extras: moved ? [] : extras, lastScanAt: now });
        // Same things as last time: look less often; something new or a new view: look again soon
        const signature = objects.map((o) => o.name).sort().join('|');
        this.interval =
          !moved && signature === this.lastNames ? Math.min(this.interval * 1.5, MAX_SCAN_INTERVAL_MS) : SCAN_INTERVAL_MS;
        if (moved) this.interval = RESCAN_AFTER_CHANGE_MS;
        this.lastNames = signature;
      }
    } catch (err) {
      console.warn('AI object identification failed:', err);
      this.publish({ status: 'offline' });
    } finally {
      if (generation === this.generation) {
        this.inFlight = false;
        if (this.running) this.schedule(this.interval);
      }
    }
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.scan(), delay);
  }

  private scan() {
    this.timer = null;
    if (!this.running || this.inFlight) return;
    if (!this.deps.isAvailable()) {
      this.publish({ status: 'offline' });
      this.schedule(MAX_SCAN_INTERVAL_MS);
      return;
    }
    this.inFlight = true;
    this.awaitingFrame = true;
    this.publish({ status: 'scanning' });
    this.deps.requestFrame();
    // If no picture arrives (camera paused), give up on this scan and try again later
    this.timer = setTimeout(() => {
      if (this.awaitingFrame) {
        this.awaitingFrame = false;
        this.inFlight = false;
        this.publish({ status: 'waiting' });
        this.schedule(this.interval);
      }
    }, 4000);
  }

  private publish(patch: Partial<SceneIdentifierState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }
}
