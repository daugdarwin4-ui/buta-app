import type { TfliteModel } from 'react-native-fast-tflite';
import type { DetectedHazard } from '../../../types/detection.types';
import { isAnnouncedHazard } from '../../../constants/hazards';
import { PerfMeter, type PerfStats } from '../perfMeter';
import { sampleCollector } from '../../training/sampleCollector';
import { isFullFrameGuess } from '../fullFrameGuess';
import { objectDetectionService } from '../objectDetection.service';
import { classifyHazard } from '../hazardClassifier';
import { sortByDanger } from '../hazardAnnouncer';
import { HazardTracker } from '../hazardTracker';
import { decodeYoloOutput, toFrameCoordinates } from '../yolo/yoloPostprocess';
import { rgbToFloat32 } from '../yolo/yoloPreprocess';
import { assessView, CameraViewMonitor, type CameraView } from '../yolo/viewQuality';
import { labelsForOutputShape } from '../yolo/yoloLabels';
import type { DetectionSource } from './detectionSource';

/** Square input size the bundled model was exported at (model/EXPORT_FOR_APP.md) */
export const YOLO_INPUT_SIZE = 320;

/** GuideAI's own model (model/train.py); its labels are picked from its output shape */
const MODEL_ASSET = require('../../../../assets/models/guideai_yolo11n_320.tflite');

/**
 * A file:// path to the bundled model that the TFLite loader can open.
 *
 * The loader reads with java.net.URL, which only understands file:// and http(s)://. In a release
 * APK, React Native hands out bundled assets as bare Android resource names, which it cannot
 * open; expo-asset copies such a resource to the app cache and returns a real file path (and
 * returns OTA-downloaded assets, already files, as they are).
 */
async function resolveModelUrl(): Promise<string | null> {
  try {
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    const asset = Asset.fromModule(MODEL_ASSET);
    await asset.downloadAsync();
    return asset.localUri ?? null;
  } catch (err) {
    console.warn('Could not prepare the model file:', err);
    return null;
  }
}

/**
 * Detections down to this confidence are decoded, but below their class threshold they only keep
 * an already-tracked object alive (HazardTracker), never report something new.
 */
const TRACK_KEEP_CONFIDENCE = 0.2;

const DEMO_INTERVAL_MS = 4500;
const DEMO_SCENARIO_COUNT = 4;

export type CameraModelState = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * Phone-camera hazards with the on-device YOLO model.
 *
 * - REAL mode: the camera view (HazardCamera) hands frames to pushFrame(); each frame runs
 *   through YOLO → per-class confidence filter → frame-to-frame tracker (confirms objects,
 *   detects approaching ones) → classifier (direction, distance, walking-path relevance).
 * - DEMO mode: used only while the model cannot run (still loading, or an app build without
 *   the camera/AI native code). Plays simulated street scenes so the flow can still be shown.
 */
class CameraSource implements DetectionSource {
  readonly id = 'camera' as const;
  readonly spokenName = 'phone camera';

  private model: TfliteModel | null = null;
  /** Class names for the loaded model, in output order */
  private labels: string[] = [];
  /** Why the model could not start, for the screen to show (null while it works) */
  private error: string | null = null;
  private state: CameraModelState = 'idle';
  private listeners = new Set<(state: CameraModelState) => void>();
  private onHazards: ((hazards: DetectedHazard[]) => void) | null = null;
  private busy = false;
  private tracker = new HazardTracker();
  private viewMonitor = new CameraViewMonitor();
  private viewListeners = new Set<(view: CameraView) => void>();
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private demoScene = 0;
  private perf = new PerfMeter();

  /** Measured analysis speed over the last few seconds (zero when no frames are being analysed) */
  get perfStats(): PerfStats {
    return this.perf.snapshot();
  }

  get isSimulated(): boolean {
    return this.state !== 'ready';
  }

  get modelState(): CameraModelState {
    return this.state;
  }

  get modelError(): string | null {
    return this.error;
  }

  /** Notified when the model becomes ready (or unavailable), e.g. to leave demo mode */
  subscribe(listener: (state: CameraModelState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** True between start() and stop() */
  get isRunning(): boolean {
    return this.onHazards !== null;
  }

  /** Whether the camera can currently see ('dark' / 'blocked' = no detections are possible) */
  get cameraView(): CameraView {
    return this.viewMonitor.view;
  }

  /** Notified when the camera becomes unable to see, and when it can see again */
  subscribeView(listener: (view: CameraView) => void): () => void {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  }

  /** Load the YOLO model once. Safe to call many times. */
  async loadModel(): Promise<void> {
    if (this.state !== 'idle') return;
    this.setState('loading');
    try {
      // Required lazily: the import itself throws in builds without the native module
      const { loadTensorflowModel } = require('react-native-fast-tflite') as typeof import('react-native-fast-tflite');
      const url = await resolveModelUrl();
      let model: TfliteModel;
      try {
        model = url ? await loadTensorflowModel({ url }, []) : await loadTensorflowModel(MODEL_ASSET, []);
      } catch (err) {
        if (!url) throw err;
        console.warn('Loading the model file failed, trying the bundled asset directly:', err);
        model = await loadTensorflowModel(MODEL_ASSET, []);
      }
      this.labels = labelsForOutputShape(model.outputs[0].shape);
      if (this.labels.length === 0) {
        throw new Error(`Unknown model output shape ${JSON.stringify(model.outputs[0].shape)}: no matching labels`);
      }
      this.model = model;
      this.setState('ready');
      if (this.onHazards) this.stopDemo(); // switch a running session to real detection
    } catch (err) {
      console.warn('YOLO model unavailable, camera stays in demo mode:', err);
      this.error = err instanceof Error ? err.message : String(err);
      this.setState('unavailable');
    }
  }

  start(onHazards: (hazards: DetectedHazard[]) => void) {
    this.stop();
    this.tracker.reset();
    this.perf.reset();
    this.onHazards = onHazards;
    if (this.state !== 'ready') this.startDemo();
    this.loadModel();
  }

  stop() {
    this.stopDemo();
    this.onHazards = null;
    if (this.viewMonitor.reset()) this.notifyView();
  }

  /**
   * Called by the camera view with a YOLO_INPUT_SIZE² letterboxed RGB image (3 bytes per pixel)
   * made from a frameWidth×frameHeight camera frame.
   * Frames arriving while the previous one is still being analysed are skipped.
   */
  async pushFrame(rgb: Uint8Array, frameWidth: number, frameHeight: number): Promise<void> {
    if (!this.onHazards || !this.model || this.busy) return;
    this.busy = true;
    try {
      // Check the camera can see before trusting an empty result as "nothing there"
      const verdict = assessView(rgb, YOLO_INPUT_SIZE, frameWidth, frameHeight);
      if (this.viewMonitor.update(verdict)) this.notifyView();
      if (verdict !== 'ok' || this.viewMonitor.view !== 'ok') {
        // A dark or covered picture makes the model guess (it once called a phone lying face down
        // an "open drain, very close"). Report nothing; the "camera can't see" warning speaks instead.
        this.tracker.reset();
        this.onHazards?.([]);
        return;
      }
      const input = rgbToFloat32(rgb);
      const started = Date.now();
      const [output] = await this.model.run([input.buffer as ArrayBuffer]);
      const inferenceMs = Date.now() - started;
      const raw = decodeYoloOutput(new Float32Array(output), {
        shape: this.model.outputs[0].shape,
        inputSize: YOLO_INPUT_SIZE,
        labels: this.labels,
        confidenceThreshold: TRACK_KEEP_CONFIDENCE,
      });
      const inFrame = toFrameCoordinates(raw, frameWidth, frameHeight, YOLO_INPUT_SIZE);
      const confident = objectDetectionService.filterConfident(inFrame.filter((d) => !isFullFrameGuess(d)));
      const unsure = inFrame.filter((d) => !confident.includes(d) && isAnnouncedHazard(d.label));
      const tracked = this.tracker.update(confident, Date.now(), unsure);
      const detections = sortByDanger(tracked.map((t) => classifyHazard(t, { approaching: t.approaching })));
      this.perf.record(inferenceMs);
      this.onHazards?.(detections.map((d) => ({ ...d, source: 'camera' as const })));
      // After the alerts, so saving a picture never delays them (does nothing unless turned on)
      sampleCollector.consider(rgb, YOLO_INPUT_SIZE, frameWidth, frameHeight, confident, unsure);
    } catch (err) {
      console.warn('YOLO inference failed:', err);
    } finally {
      this.busy = false;
    }
  }

  private notifyView() {
    const view = this.viewMonitor.view;
    this.viewListeners.forEach((l) => l(view));
  }

  private setState(state: CameraModelState) {
    this.state = state;
    this.listeners.forEach((l) => l(state));
  }

  private startDemo() {
    const emit = () => {
      const { detections } = objectDetectionService.generateSimulatedScene(this.demoScene, false);
      this.onHazards?.(detections.map((d) => ({ ...d, source: 'camera' as const })));
      this.demoScene = (this.demoScene + 1) % DEMO_SCENARIO_COUNT;
    };
    emit();
    this.demoTimer = setInterval(emit, DEMO_INTERVAL_MS);
  }

  private stopDemo() {
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
  }
}

export const cameraSource = new CameraSource();
