import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geminiService } from '../services/ai/gemini.service';
import { SceneIdentifier, type SceneIdentifierState } from '../services/ai/sceneIdentifier';
import { vocabularyWith } from '../constants/vocabulary';
import type { DetectedHazard } from '../types/detection.types';

interface Options {
  /** Camera is showing and analysing, and the user has AI identification on */
  active: boolean;
  /** Ask the camera for one sharp picture (HazardCamera's requestHiResFrame) */
  requestFrame: (() => void) | null;
  detections: DetectedHazard[];
  customNames: string[];
}

/** Runs the AI object identifier while the camera screen is live */
export function useSceneIdentifier({ active, requestFrame, detections, customNames }: Options) {
  const vocabulary = useMemo(() => vocabularyWith(customNames), [customNames]);
  const vocabularyRef = useRef(vocabulary);
  vocabularyRef.current = vocabulary;
  const requestRef = useRef(requestFrame);
  requestRef.current = requestFrame;

  const identifier = useMemo(
    () =>
      new SceneIdentifier({
        requestFrame: () => requestRef.current?.(),
        identify: (jpeg, known) => geminiService.identifyObjects(jpeg, { known, vocabulary: vocabularyRef.current }),
        isAvailable: () => geminiService.isAvailable,
      }),
    []
  );

  const [state, setState] = useState<SceneIdentifierState>(identifier.current);
  useEffect(() => identifier.subscribe(setState), [identifier]);

  useEffect(() => {
    if (active && requestFrame) identifier.start();
    else identifier.stop();
  }, [active, !!requestFrame, identifier]);
  useEffect(() => () => identifier.stop(), [identifier]);

  useEffect(() => {
    identifier.setDetections(detections);
  }, [detections, identifier]);

  const onHiResFrame = useCallback(
    (rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number) =>
      identifier.onHiResFrame(rgb, size, frameWidth, frameHeight),
    [identifier]
  );

  /** Every analysed camera frame (the small YOLO image), to notice when the view changes */
  const onFrame = useCallback(
    (rgb: Uint8Array, size: number, frameWidth: number, frameHeight: number) =>
      identifier.onFrame(rgb, size, frameWidth, frameHeight),
    [identifier]
  );

  return { state, onHiResFrame, onFrame };
}
