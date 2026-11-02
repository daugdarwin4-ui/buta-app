import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { hazardAnnouncer, rankOf, sortByDanger } from '../services/detection/hazardAnnouncer';
import { groupWarning, spokenWarning } from '../services/detection/spokenWarning';
import { cameraSource, type CameraModelState } from '../services/detection/sources/cameraSource';
import { caneSource } from '../services/detection/sources/caneSource';
import type { DetectionSource } from '../services/detection/sources/detectionSource';
import { useDetectionStore } from '../stores/detectionStore';
import { useUserStore } from '../stores/userStore';
import { ttsService } from '../services/tts/tts.service';
import { hapticsService } from '../services/haptics/haptics.service';
import { CAMERA_VIEW_MESSAGES, type CameraView } from '../services/detection/yolo/viewQuality';
import type { DetectedHazard, DetectionSourceId, DetectionSourceSetting } from '../types/detection.types';

/** "Describe what's ahead" lists at most this many hazards, so it stays a few seconds long */
const MAX_DESCRIBED = 4;
const TRAILING_PERIOD = /\.$/;

/** While the camera cannot see, repeat the warning this often */
const VIEW_WARNING_REPEAT_MS = 20000;

function sourcesFor(setting: DetectionSourceSetting): DetectionSource[] {
  if (setting === 'both') return [cameraSource, caneSource];
  return setting === 'cane' ? [caneSource] : [cameraSource];
}

/**
 * Obstacle detection from the phone camera, the cane device, or both (user setting).
 * Each source reports its own hazards; they are merged and announced through one announcer.
 */
export function useObjectDetection() {
  const { detections, setActive, setDetections, clearDetections } = useDetectionStore();
  const sourceSetting = useUserStore((s) => s.settings.detection_source);
  const [isScanning, setIsScanning] = useState(false);
  const latestRef = useRef<Partial<Record<DetectionSourceId, DetectedHazard[]>>>({});

  const sources = useMemo(() => sourcesFor(sourceSetting), [sourceSetting]);
  // Read through a ref so callers holding an older startScanning still use the current setting
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  // Load the YOLO model early and re-render when it becomes ready, to leave demo mode
  const [cameraModelState, setCameraModelState] = useState<CameraModelState>(cameraSource.modelState);
  useEffect(() => {
    const unsubscribe = cameraSource.subscribe(setCameraModelState);
    cameraSource.loadModel();
    return unsubscribe;
  }, []);

  // Whether the camera can see. A dark or covered camera must never read as "path clear".
  const [cameraView, setCameraView] = useState<CameraView>(cameraSource.cameraView);
  useEffect(() => cameraSource.subscribeView(setCameraView), []);
  const prevViewRef = useRef<CameraView>('ok');
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = cameraView;
    if (cameraView !== 'ok') {
      if (!isScanning) return;
      const message = CAMERA_VIEW_MESSAGES[cameraView];
      ttsService.speak(message, 'warning');
      hapticsService.triggerForRisk('warning');
      const timer = setInterval(() => ttsService.speak(message, 'warning'), VIEW_WARNING_REPEAT_MS);
      return () => clearInterval(timer);
    }
    // Recovered while still scanning (not just because the camera was stopped)
    if (prev !== 'ok' && isScanning && cameraSource.isRunning) {
      ttsService.speak('Camera can see again.', 'info');
    }
  }, [cameraView, isScanning]);

  const stopSources = useCallback(() => {
    cameraSource.stop();
    caneSource.stop();
    latestRef.current = {};
  }, []);

  /** Start detection with spoken + vibration alerts */
  const startScanning = useCallback(() => {
    stopSources();
    setActive(true);
    setIsScanning(true);
    for (const source of sourcesRef.current) {
      source.start((hazards) => {
        // Replace this source's latest view, merge with the others, announce once
        latestRef.current[source.id] = hazards;
        const merged = sortByDanger(Object.values(latestRef.current).flat() as DetectedHazard[]);
        setDetections(merged);
        hazardAnnouncer.announce(hazards);
      });
    }
  }, [stopSources, setActive, setDetections]);

  /** Stop detection and silence alerts */
  const stopScanning = useCallback(() => {
    stopSources();
    setActive(false);
    setIsScanning(false);
    clearDetections();
  }, [stopSources, setActive, clearDetections]);

  // Switching the source in Settings while scanning restarts with the new source(s)
  useEffect(() => {
    if (isScanning) startScanning();
  }, [sources]);

  useEffect(() => stopSources, [stopSources]);

  /**
   * Speak everything currently detected, ignoring the repeat-suppression throttle.
   * `aiAddition`: what the AI identifier saw besides the hazards, e.g. "The AI also sees a broom ahead."
   */
  const describeNow = useCallback(
    (aiAddition?: string) => {
      const extra = aiAddition ? ` ${aiAddition}` : '';
      if (!isScanning) {
        ttsService.speakImmediate('Detection is paused. Tap resume to start.');
      } else if (detections.length === 0 && cameraView !== 'ok') {
        // Nothing detected because nothing can be seen: say so, never "clear"
        ttsService.speakImmediate(CAMERA_VIEW_MESSAGES[cameraView]);
      } else if (detections.length === 0) {
        // "No hazards detected", not "clear", when the AI still reports objects
        // Never "the path is clear": the camera can miss thin, glass or low obstacles and drop-offs
        ttsService.speakImmediate(
          aiAddition ? `No hazards detected.${extra}` : 'No obstacles detected. Keep using your cane.',
          aiAddition ? 'critical' : 'info'
        );
      } else {
        // The most dangerous few, in one message. Spoken at alert priority so that the next
        // automatic alert waits for it instead of cutting the list off (urgent ones still cut in).
        // Same voice rule as the alerts: living things by name, everything else "obstacle"
        const ordered = [...detections].sort((a, b) => rankOf(a) - rankOf(b));
        const counts = new Map<string, number>();
        for (const d of ordered) counts.set(spokenWarning(d), (counts.get(spokenWarning(d)) ?? 0) + 1);
        const phrases = [
          ...new Set(ordered.map((d) => groupWarning(d, counts.get(spokenWarning(d)) ?? 1).replace(TRAILING_PERIOD, ''))),
        ];
        const listed = phrases.slice(0, MAX_DESCRIBED);
        const more = phrases.length - listed.length;
        const sentence = listed.join('. ');
        ttsService.speakImmediate(`${sentence}.${more > 0 ? ` And ${more} more.` : ''}${extra}`, 'critical');
      }
    },
    [detections, isScanning, cameraView]
  );

  return {
    isScanning,
    /** True when any active source is showing demo data */
    isDemo: sources.some((s) => (s.id === 'camera' ? cameraModelState !== 'ready' : s.isSimulated)),
    /** Show the camera and feed it to YOLO (camera source active and the model loaded) */
    cameraActive: isScanning && sources.includes(cameraSource) && cameraModelState === 'ready',
    /** Why the camera is in demo mode, for the screen to explain */
    cameraModelState,
    /** The technical reason the camera AI could not start, if it failed */
    cameraModelError: cameraModelState === 'unavailable' ? cameraSource.modelError : null,
    /** 'dark' / 'blocked' when the phone camera cannot see (only while the camera runs) */
    cameraView,
    onCameraFrame: cameraSource.pushFrame.bind(cameraSource),
    /** e.g. "phone camera and cane device" */
    sourceName: sources.map((s) => s.spokenName).join(' and '),
    detections,
    startScanning,
    stopScanning,
    describeNow,
  };
}
