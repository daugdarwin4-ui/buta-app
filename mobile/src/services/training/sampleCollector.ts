import type { RawDetection } from '../../types/detection.types';
import { encodeBmp } from '../../utils/bmp';
import { letterboxGeometry } from '../detection/yolo/yoloPreprocess';

/**
 * "Improve My AI": optionally keeps camera pictures the model was unsure about, so they can be
 * labelled on the PC and used to train the next model (model/datasets/import_phone_samples.py).
 *
 * - Only runs when the user turns it on in Settings. Pictures stay on the phone until exported.
 * - The model's guesses are saved next to each picture as SUGGESTIONS for whoever labels it.
 *   They are never treated as labels, and nothing is retrained automatically.
 */

/** unsure / periodic: saved automatically; manual: the user pressed Teach and named the object */
export type SampleReason = 'unsure' | 'periodic' | 'manual';

/** At most this many pictures are kept (each is about 230 KB) */
export const MAX_SAMPLES = 300;
/** A picture with an unsure detection at most this often */
export const UNSURE_GAP_MS = 10_000;
/**
 * Also one picture this often even when the model saw nothing: those catch what it MISSED
 * (a pothole it did not notice), which matters most for safety.
 */
export const PERIODIC_GAP_MS = 60_000;

const FOLDER = 'training-samples';

/** Why to save this frame, or null to skip it */
export function sampleReason(opts: {
  now: number;
  lastSavedAt: number;
  unsureCount: number;
  stored: number;
}): SampleReason | null {
  if (opts.stored >= MAX_SAMPLES) return null;
  const since = opts.now - opts.lastSavedAt;
  if (opts.unsureCount > 0 && since >= UNSURE_GAP_MS) return 'unsure';
  if (since >= PERIODIC_GAP_MS) return 'periodic';
  return null;
}

/** File name stem, e.g. "gai_20261014_141530_unsure" (sorts by time) */
export function sampleName(date: Date, reason: SampleReason): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `gai_${stamp}_${reason}`;
}

/** Sidecar with the model's guesses, in YOLO box format (center x/y, width, height; 0–1) */
export function suggestionsJson(
  reason: SampleReason,
  width: number,
  height: number,
  detections: (RawDetection & { reported: boolean })[],
  userLabel?: string
): string {
  return JSON.stringify(
    {
      note: 'Model guesses only - NOT verified labels. Check every box before training.',
      reason,
      // What the user said the main object is (Teach). The box still has to be drawn on the PC.
      ...(userLabel ? { userLabel } : {}),
      savedAt: new Date().toISOString(),
      width,
      height,
      suggestions: detections.map((d) => ({
        label: d.label,
        confidence: Math.round(d.confidence * 1000) / 1000,
        reported: d.reported,
        x_center: d.bbox.x + d.bbox.width / 2,
        y_center: d.bbox.y + d.bbox.height / 2,
        width: d.bbox.width,
        height: d.bbox.height,
      })),
    },
    null,
    2
  );
}

type FileSystemModule = typeof import('expo-file-system');

/** Loaded lazily: builds without the native module simply have no sample collection */
function fileSystem(): FileSystemModule | null {
  try {
    return require('expo-file-system') as FileSystemModule;
  } catch {
    return null;
  }
}

export interface SampleInfo {
  name: string;
  uri: string;
}

class SampleCollector {
  private enabled = false;
  private lastSavedAt = 0;
  private stored: number | null = null;
  private listeners = new Set<(count: number) => void>();
  /** Set by captureNext(): the next frame is saved as a Teach picture */
  private pendingManual: ((name: string | null) => void) | null = null;

  setEnabled(enabled: boolean) {
    // When turned on, wait a moment before the first picture (not the instant the switch is hit)
    if (enabled && !this.enabled) this.lastSavedAt = Date.now() - PERIODIC_GAP_MS + UNSURE_GAP_MS;
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Whether this app build can store pictures at all */
  get isAvailable(): boolean {
    return fileSystem() !== null;
  }

  /** Notified with the new count whenever pictures are saved or deleted */
  subscribe(listener: (count: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Called with every analysed camera frame (the YOLO_INPUT_SIZE² letterboxed RGB image).
   * `confident` were reported; `unsure` were below their class threshold.
   */
  consider(
    rgb: Uint8Array,
    size: number,
    frameWidth: number,
    frameHeight: number,
    confident: RawDetection[],
    unsure: RawDetection[],
    now = Date.now()
  ): void {
    const manual = this.pendingManual;
    this.pendingManual = null;
    let reason: SampleReason | null = manual ? 'manual' : null;
    if (!reason && this.enabled) {
      reason = sampleReason({ now, lastSavedAt: this.lastSavedAt, unsureCount: unsure.length, stored: this.count() });
    }
    if (!reason) return;
    if (!manual) this.lastSavedAt = now;
    try {
      const fs = fileSystem();
      if (!fs) return;
      const dir = this.directory(fs);
      // Cut away the gray letterbox bars: the picture is then exactly the camera frame, so the
      // frame-relative boxes are also picture-relative
      const { innerWidth, innerHeight, padX, padY } = letterboxGeometry(frameWidth, frameHeight, size);
      const image = encodeBmp(rgb, size, { x: padX, y: padY, width: innerWidth, height: innerHeight });
      const name = sampleName(new Date(now), reason);
      new fs.File(dir, `${name}.bmp`).write(image);
      const all = [
        ...confident.map((d) => ({ ...d, reported: true })),
        ...unsure.map((d) => ({ ...d, reported: false })),
      ];
      new fs.File(dir, `${name}.json`).write(suggestionsJson(reason, innerWidth, innerHeight, all));
      this.stored = this.count() + 1;
      this.notify();
      manual?.(name);
    } catch (err) {
      console.warn('Could not save a training picture:', err);
      manual?.(null);
    }
  }

  /**
   * Teach: save the very next analysed camera frame (even when automatic saving is off).
   * Resolves with the saved picture's name (to attach the user's label), or null if it failed
   * or no frame arrived within a few seconds (camera paused).
   */
  captureNext(): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingManual === done) this.pendingManual = null;
        resolve(null);
      }, 3000);
      const done = (name: string | null) => {
        clearTimeout(timer);
        resolve(name);
      };
      this.pendingManual = done;
    });
  }

  /** Attach the name the user gave to a picture saved by captureNext() */
  setUserLabel(stem: string, userLabel: string): void {
    const fs = fileSystem();
    if (!fs) return;
    try {
      const file = new fs.File(this.directory(fs), `${stem}.json`);
      const data = JSON.parse(file.textSync());
      data.userLabel = userLabel.trim().toLowerCase();
      file.write(JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn('Could not save the object name:', err);
    }
  }

  /** Delete one picture (e.g. the user cancelled naming it) */
  remove(stem: string): void {
    const fs = fileSystem();
    if (!fs) return;
    try {
      for (const ext of ['.bmp', '.json']) {
        const file = new fs.File(this.directory(fs), stem + ext);
        if (file.exists) file.delete();
      }
      this.stored = null;
      this.notify();
    } catch (err) {
      console.warn('Could not delete the picture:', err);
    }
  }

  /** Number of saved pictures */
  count(): number {
    if (this.stored === null) this.stored = this.list().length;
    return this.stored;
  }

  /** Saved pictures, newest first */
  list(): SampleInfo[] {
    const fs = fileSystem();
    if (!fs) return [];
    try {
      const dir = new fs.Directory(fs.Paths.document, FOLDER);
      if (!dir.exists) return [];
      return dir
        .list()
        .filter((entry) => entry.name.endsWith('.bmp'))
        .map((entry) => ({ name: entry.name, uri: entry.uri }))
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch (err) {
      console.warn('Could not list training pictures:', err);
      return [];
    }
  }

  /** Delete every saved picture */
  clear(): void {
    const fs = fileSystem();
    if (!fs) return;
    const dir = new fs.Directory(fs.Paths.document, FOLDER);
    if (dir.exists) dir.delete();
    this.stored = 0;
    this.notify();
  }

  /**
   * Copy all pictures and their suggestion files into a folder the user picks (e.g. Download),
   * from where they can be copied to the PC over USB. Returns the number of pictures copied,
   * or null if the user cancelled.
   */
  async exportToPickedFolder(): Promise<{ copied: number; folder: string } | null> {
    const fs = fileSystem();
    if (!fs) throw new Error('Saving files is not available in this version of the app.');
    const source = new fs.Directory(fs.Paths.document, FOLDER);
    if (!source.exists) return { copied: 0, folder: '' };

    let target: InstanceType<FileSystemModule['Directory']>;
    try {
      target = await fs.Directory.pickDirectoryAsync();
    } catch {
      return null; // picker closed
    }
    const folder = `GuideAI-samples-${sampleName(new Date(), 'unsure').slice(4, 19)}`;
    const out = target.createDirectory(folder);
    let copied = 0;
    for (const entry of source.list()) {
      if (!(entry instanceof fs.File)) continue;
      const isImage = entry.name.endsWith('.bmp');
      const copy = out.createFile(entry.name, isImage ? 'image/bmp' : 'application/json');
      copy.write(await entry.bytes());
      if (isImage) copied++;
    }
    return { copied, folder };
  }

  private directory(fs: FileSystemModule) {
    const dir = new fs.Directory(fs.Paths.document, FOLDER);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  }

  private notify() {
    const count = this.count();
    this.listeners.forEach((l) => l(count));
  }
}

export const sampleCollector = new SampleCollector();
