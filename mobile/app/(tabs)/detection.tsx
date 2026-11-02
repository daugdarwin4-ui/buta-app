import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { keepAwake } from '../../src/services/native/keepAwake';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { useObjectDetection } from '../../src/hooks/useObjectDetection';
import { HazardBanner } from '../../src/components/detection/HazardBanner';
import { DetectionOverlay } from '../../src/components/detection/DetectionOverlay';
import { DetectionHud } from '../../src/components/detection/DetectionHud';
import { cameraSource, YOLO_INPUT_SIZE } from '../../src/services/detection/sources/cameraSource';
import type { PerfStats } from '../../src/services/detection/perfMeter';
import { ttsService } from '../../src/services/tts/tts.service';
import { hapticsService } from '../../src/services/haptics/haptics.service';
import { CAMERA_VIEW_MESSAGES } from '../../src/services/detection/yolo/viewQuality';
import type { Size } from '../../src/utils/overlayGeometry';
import { useUserStore } from '../../src/stores/userStore';
import { useSceneIdentifier } from '../../src/hooks/useSceneIdentifier';
import { TeachButton } from '../../src/components/detection/TeachButton';
import { spokenName } from '../../src/services/ai/sceneIdentifier';
import { mapDirection } from '../../src/utils/directionMapper';

const directionPhrase = (dir: 'left' | 'ahead' | 'right') => (dir === 'ahead' ? 'ahead' : `on your ${dir}`);

// Loaded lazily: importing the camera library throws in app builds without its native code
// (e.g. Expo Go or an older install). Then the camera simply stays in demo mode.
type HazardCameraModule = typeof import('../../src/components/detection/HazardCamera');
let HazardCamera: HazardCameraModule['HazardCamera'] | null = null;
let requestHiResFrame: HazardCameraModule['requestHiResFrame'] | null = null;
let HI_RES_SIZE = 0;
let hazardCameraError: string | null = null;
try {
  const cameraModule: HazardCameraModule = require('../../src/components/detection/HazardCamera');
  HazardCamera = cameraModule.HazardCamera;
  requestHiResFrame = cameraModule.requestHiResFrame;
  HI_RES_SIZE = cameraModule.HI_RES_SIZE;
} catch (err) {
  HazardCamera = null;
  hazardCameraError = err instanceof Error ? err.message : String(err);
  console.warn('Camera view unavailable:', err);
}

export default function DetectionScreen() {
  const isFocused = useIsFocused();
  const {
    isScanning,
    isDemo,
    sourceName,
    detections,
    startScanning,
    stopScanning,
    describeNow,
    cameraActive,
    cameraModelState,
    cameraModelError,
    cameraView,
    onCameraFrame,
  } =
    useObjectDetection();
  // Why detections are simulated, so the user/demo audience knows what is missing
  const demoReason =
    cameraModelState === 'loading' || cameraModelState === 'idle'
      ? 'the camera AI is still loading.'
      : cameraModelState === 'unavailable' || !HazardCamera
        ? 'the camera AI is not installed in this version of the app.'
        : 'detections are simulated until the cane is connected.';

  // The exact failure, shown small under the badge so a tester can report it
  const [frameError, setFrameError] = useState<string | null>(null);
  const technicalReason = cameraModelError ?? (isDemo ? hazardCameraError : null) ?? frameError;

  // For drawing detection boxes over the preview: the camera frame size and the preview size
  const [frameSize, setFrameSize] = useState<Size | null>(null);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  // The title strip covers the top of the picture; box labels there are moved below it
  const [headerHeight, setHeaderHeight] = useState(0);
  const showCamera = cameraActive && !!HazardCamera;

  // Measured camera AI speed, refreshed once a second while the camera is analysing
  const [perf, setPerf] = useState<PerfStats | null>(null);
  useEffect(() => {
    if (!showCamera || !isScanning) {
      setPerf(null);
      return;
    }
    const timer = setInterval(() => setPerf(cameraSource.perfStats), 1000);
    return () => clearInterval(timer);
  }, [showCamera, isScanning]);

  // AI object names (Gemini) for things YOLO can't name; YOLO alone drives the spoken alerts
  const smartIdentify = useUserStore((s) => s.settings.smart_identify);
  const customNames = useUserStore((s) => s.settings.custom_object_names);
  const { state: ai, onHiResFrame, onFrame: onAiFrame } = useSceneIdentifier({
    // Not while the camera is covered or in the dark: nothing to name, and it would waste data
    active: showCamera && isScanning && isFocused && smartIdentify && cameraView === 'ok',
    requestFrame: requestHiResFrame,
    detections,
    customNames,
  });

  const teachMode = useUserStore((s) => s.settings.collect_training_photos);
  const updateSettings = useUserStore((s) => s.updateSettings);
  const addCustomName = (name: string) => {
    if (customNames.includes(name)) return;
    updateSettings({ custom_object_names: [...customNames, name].slice(-100) }).catch((err) =>
      console.warn('Could not save the object name:', err)
    );
  };

  const handleDescribe = () => {
    // Voice rule: only living things are named aloud; other AI-named objects stay on screen only
    const living = ai.extras.filter((e) => e.category === 'person' || e.category === 'animal');
    const parts = living.map((e) => `${spokenName(e.name, e.certainty)} ${directionPhrase(mapDirection(e.bbox))}`);
    describeNow(parts.length ? `The AI also sees ${parts.slice(0, 4).join(', ')}.` : undefined);
  };

  // Latest values for the focus callback (which is created once)
  const sourceRef = useRef({ sourceName, isDemo });
  sourceRef.current = { sourceName, isDemo };

  // Tabs stay mounted, so tie detection to focus: on when the user is here, off when they leave.
  useFocusEffect(
    useCallback(() => {
      ttsService.speakImmediate(
        `Obstacle detection on, using ${sourceRef.current.sourceName}${sourceRef.current.isDemo ? ', demo mode' : ''}. Tap the middle of the screen to pause.`
      );
      startScanning();
      // Android pauses the app when the screen locks, which would silence hazard alerts
      keepAwake.activate('detection');
      return () => {
        stopScanning();
        keepAwake.deactivate('detection');
      };
    }, [])
  );

  const handleToggle = async () => {
    await hapticsService.buttonPress();
    if (isScanning) {
      stopScanning();
      ttsService.speakImmediate('Detection paused.');
    } else {
      startScanning();
      // Android pauses the app when the screen locks, which would silence hazard alerts
      keepAwake.activate('detection');
      ttsService.speakImmediate('Detection resumed.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Stage: the camera fills it, detection boxes are drawn on top, and all of it is the
          pause / resume button (the largest possible target) */}
      <View
        style={styles.stage}
        onLayout={(e) => setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {showCamera && HazardCamera && (
          <HazardCamera
            active={isFocused && isScanning}
            onFrame={(rgb, w, h) => {
              if (frameError) setFrameError(null); // frames are arriving again
              if (frameSize?.width !== w || frameSize?.height !== h) setFrameSize({ width: w, height: h });
              onCameraFrame(rgb, w, h);
              onAiFrame(rgb, YOLO_INPUT_SIZE, w, h);
            }}
            onError={(message) => setFrameError(message.slice(0, 200))}
            onHiResFrame={(rgb, w, h) => onHiResFrame(rgb, HI_RES_SIZE, w, h)}
            style={styles.camera}
          />
        )}
        {showCamera && isScanning && (
          <DetectionOverlay
            detections={detections}
            frame={frameSize}
            view={stageSize}
            aiNames={ai.names}
            aiExtras={ai.extras}
            coveredTop={headerHeight}
          />
        )}

        <TouchableOpacity
          style={styles.toggleArea}
          onPress={handleToggle}
          accessibilityLabel={isScanning ? 'Pause obstacle alerts' : 'Resume obstacle alerts'}
          accessibilityHint="Double tap anywhere in the middle of the screen"
          accessibilityState={{ checked: isScanning }}
          accessibilityRole="switch"
          activeOpacity={0.9}
        >
          {/* Shown when there is no live picture to look at: paused, loading, or cane only */}
          {!(showCamera && isScanning) && (
            <View style={[styles.statusCard, isScanning ? styles.statusOn : styles.statusOff]}>
              <Text style={styles.toggleIcon}>{isScanning ? '⏸' : '▶'}</Text>
              <Text style={styles.toggleText}>{isScanning ? 'Pause Alerts' : 'Resume Alerts'}</Text>
              <Text style={styles.toggleSub}>{isScanning ? 'Listening for hazards' : 'Alerts are off'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title over the picture; touches pass through to the pause area */}
        <SafeAreaView
          style={styles.header}
          edges={['top']}
          pointerEvents="none"
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <Text style={styles.screenTitle} accessibilityRole="header">
            Obstacle Detection
          </Text>
          <Text
            style={isDemo ? styles.demoBadge : styles.sourceText}
            accessibilityLabel={`Using ${sourceName}.${isDemo ? ` Demo mode: ${demoReason}` : ''}`}
          >
            Using {sourceName}{isDemo ? ' — DEMO (simulated)' : ''}
          </Text>
          {technicalReason && (
            <Text style={styles.technicalReason} accessibilityLabel={`Camera AI error: ${technicalReason}`}>
              Camera AI error: {technicalReason}
            </Text>
          )}
          {isScanning && (
            <DetectionHud
              detections={detections}
              perf={perf}
              ai={smartIdentify && showCamera ? { status: ai.status, extras: ai.extras.length, lastScanAt: ai.lastScanAt } : null}
            />
          )}
        </SafeAreaView>

        <View style={styles.stageFooter} pointerEvents="box-none">
          {showCamera && isScanning && (
            <View style={styles.hintRow} pointerEvents="box-none">
              <Text style={styles.pauseHint} accessibilityElementsHidden importantForAccessibility="no">
                ⏸ Tap anywhere to pause
              </Text>
              {/* Only in Teach My AI mode, so the screen stays simple for everyday use */}
              {teachMode && <TeachButton onTaught={addCustomName} />}
            </View>
          )}
          <TouchableOpacity
            style={styles.describeButton}
            onPress={handleDescribe}
            accessibilityLabel="Describe what is ahead"
            accessibilityHint="Speaks the obstacles currently detected, and other objects the AI recognised"
            accessibilityRole="button"
          >
            <Text style={styles.describeText}>🔊 Describe What's Ahead</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hidden while paused so an empty list never reads as "Path Clear" */}
      {isScanning && (
        <HazardBanner
          detections={detections}
          viewWarning={cameraActive && cameraView !== 'ok' ? CAMERA_VIEW_MESSAGES[cameraView] : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
  },
  toggleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  statusCard: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 96,
    marginBottom: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusOn: {
    backgroundColor: '#7F1D1D',
  },
  statusOff: {
    backgroundColor: '#0C4A6E',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 10,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 8,
  },
  sourceText: {
    color: '#E5E7EB',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  demoBadge: {
    color: '#FCD34D',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  technicalReason: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  stageFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pauseHint: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  toggleIcon: {
    fontSize: 64,
    color: '#FFFFFF',
  },
  toggleText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  toggleSub: {
    color: '#E5E7EB',
    fontSize: Typography.fontSize.md,
  },
  describeButton: {
    alignSelf: 'stretch',
    minHeight: MIN_TOUCH_TARGET + 16,
    borderRadius: 18,
    backgroundColor: 'rgba(31,41,55,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  describeText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
});
