import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraPermission,
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';
import { frameToRgb } from '../../services/detection/yolo/yoloPreprocess';
import { YOLO_INPUT_SIZE } from '../../services/detection/sources/cameraSource';

/** ~3 analyses per second: enough for walking speed, gentle on battery and heat */
const ANALYSIS_INTERVAL_MS = 350;

/** Size of the occasional sharper picture sent to the AI object identifier (sceneIdentifier) */
export const HI_RES_SIZE = 512;

/** Set from JS when the AI identifier wants a sharper picture; the camera thread clears it */
const hiResWanted = createSynchronizable(false);

/** Ask the camera for one HI_RES_SIZE picture, delivered through HazardCamera's onHiResFrame */
export function requestHiResFrame() {
  hiResWanted.setBlocking(true);
}

interface HazardCameraProps {
  /** Camera runs only while true (screen focused and scanning) */
  active: boolean;
  /** Receives a YOLO_INPUT_SIZE² letterboxed RGB image (3 bytes per pixel) and the camera frame size, on the JS thread */
  onFrame: (rgb: Uint8Array, frameWidth: number, frameHeight: number) => void;
  /** A frame could not be read (shown to testers; detection cannot work while this happens) */
  onError?: (message: string) => void;
  /** Receives a HI_RES_SIZE² letterboxed RGB picture after requestHiResFrame() */
  onHiResFrame?: (rgb: Uint8Array, frameWidth: number, frameHeight: number) => void;
  style?: ViewStyle;
}

/**
 * Back camera feeding the YOLO hazard model. Frames are downsampled on the camera thread
 * (a worklet), so only a small 320×320 image crosses over to JavaScript.
 *
 * The preview is shown for sighted helpers and demos; it is hidden from the screen reader.
 */
export function HazardCamera({ active, onFrame, onError, onHiResFrame, style }: HazardCameraProps) {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission && canRequestPermission) requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  // Shared between the camera thread and JS: time of the last analysed frame
  const lastRun = useMemo(() => createSynchronizable(0), []);
  // Shared flag: frame.getPixelBuffer() does not work in this app build, read the plane instead.
  // (It needs the app compiled for Android 8+ / minSdk 26; planes work on every build.)
  const usePlanes = useMemo(() => createSynchronizable(false), []);

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const deliver = useCallback(
    (buffer: ArrayBuffer, frameWidth: number, frameHeight: number) =>
      onFrameRef.current(new Uint8Array(buffer), frameWidth, frameHeight),
    []
  );
  const onHiResRef = useRef(onHiResFrame);
  onHiResRef.current = onHiResFrame;
  const deliverHiRes = useCallback(
    (buffer: ArrayBuffer, frameWidth: number, frameHeight: number) =>
      onHiResRef.current?.(new Uint8Array(buffer), frameWidth, frameHeight),
    []
  );
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const reportError = useCallback((message: string) => {
    console.warn('Camera frame could not be read:', message);
    onErrorRef.current?.(message);
  }, []);

  const handleFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      const now = Date.now();
      if (now - lastRun.getDirty() < ANALYSIS_INTERVAL_MS) {
        frame.dispose();
        return;
      }
      lastRun.setBlocking(now);
      try {
        let pixels: ArrayBuffer | null = null;
        let bytesPerRow = frame.bytesPerRow;
        if (!usePlanes.getDirty()) {
          try {
            pixels = frame.getPixelBuffer();
          } catch (e) {
            usePlanes.setBlocking(true); // not supported in this build: use the plane from now on
          }
        }
        if (pixels == null) {
          // RGB frames have exactly one plane holding all pixels
          const planes = frame.getPlanes();
          if (planes.length !== 1) {
            scheduleOnRN(reportError, 'Camera frame has ' + planes.length + ' planes (' + frame.pixelFormat + '), expected 1');
            return;
          }
          pixels = planes[0].getPixelBuffer();
          bytesPerRow = planes[0].bytesPerRow;
        }
        const rgb = frameToRgb(
          new Uint8Array(pixels),
          frame.width,
          frame.height,
          bytesPerRow,
          frame.pixelFormat,
          YOLO_INPUT_SIZE
        );
        if (rgb) scheduleOnRN(deliver, rgb.buffer as ArrayBuffer, frame.width, frame.height);
        else scheduleOnRN(reportError, 'Unsupported camera pixel format: ' + frame.pixelFormat);
        if (rgb && hiResWanted.getDirty()) {
          // Occasional sharper copy of the same frame for the AI identifier (a few seconds apart)
          hiResWanted.setBlocking(false);
          const hiRes = frameToRgb(
            new Uint8Array(pixels),
            frame.width,
            frame.height,
            bytesPerRow,
            frame.pixelFormat,
            HI_RES_SIZE
          );
          if (hiRes) scheduleOnRN(deliverHiRes, hiRes.buffer as ArrayBuffer, frame.width, frame.height);
        }
      } catch (e) {
        scheduleOnRN(reportError, String(e));
      } finally {
        frame.dispose();
      }
    },
    [lastRun, usePlanes, deliver, deliverHiRes, reportError]
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    targetResolution: CommonResolutions.VGA_4_3,
    enablePreviewSizedOutputBuffers: true,
    // Upright pixels, so left/right in the image match the user's left/right
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame: handleFrame,
  });

  if (!hasPermission) {
    return (
      <View style={[styles.placeholder, style]} accessible accessibilityLabel="Camera permission is needed for obstacle detection.">
        <Text style={styles.placeholderText}>Camera permission needed</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Camera style={StyleSheet.absoluteFill} device="back" isActive={active} outputs={[frameOutput]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#000000',
  },
  placeholder: {
    borderRadius: 20,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
});
