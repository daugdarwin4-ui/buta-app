import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { useTextReader } from '../../src/hooks/useTextReader';
import { TextResultCard } from '../../src/components/ocr/TextResultCard';
import { AccessibleButton } from '../../src/components/common/AccessibleButton';
import { ttsService } from '../../src/services/tts/tts.service';
import { hapticsService } from '../../src/services/haptics/haptics.service';

/** Time for the camera to start and focus before an automatic "describe" photo */
const DESCRIBE_CAMERA_WARMUP_MS = 2000;

export default function TextReaderScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  // Tabs stay mounted: only run the camera while this tab is on screen
  const isFocused = useIsFocused();
  const {
    cameraRef,
    status,
    result,
    error,
    history,
    captureAndRead,
    captureAndDescribe,
    canDescribe,
    readResultAloud,
    clearResult,
  } = useTextReader();

  // "What is in front of me?" asked by voice: take the photo by itself once the camera is up
  const { describe } = useLocalSearchParams<{ describe?: string }>();
  const describedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!describe || describedRef.current === describe || !permission?.granted || !isFocused) return;
    describedRef.current = describe;
    const timer = setTimeout(() => captureAndDescribe(), DESCRIBE_CAMERA_WARMUP_MS);
    return () => clearTimeout(timer);
  }, [describe, permission?.granted, isFocused]);


  useFocusEffect(
    useCallback(() => {
      ttsService.speak(
        'Text reader. Hold the phone about 30 centimeters from the text, then tap Read Text at the bottom of the screen.',
        'info'
      );
    }, [])
  );

  const isProcessing = status === 'capturing' || status === 'processing';

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission…</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle} accessibilityRole="header">
          Camera Access Required
        </Text>
        <Text style={styles.permissionText}>
          GuideAI needs camera access to read text from signs, labels, and documents.
        </Text>
        <AccessibleButton
          label="Grant Camera Permission"
          hint="Allow GuideAI to use your camera"
          variant="primary"
          size="lg"
          style={styles.permissionButton}
          onPress={async () => {
            await requestPermission();
          }}
        />
        <AccessibleButton
          label="Go Back"
          hint="Return to the previous screen"
          variant="ghost"
          size="lg"
          style={styles.permissionButton}
          onPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.navIcon}>←</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle} accessibilityRole="header">
          Text Reader
        </Text>

        <TouchableOpacity
          style={styles.navButton}
          onPress={readResultAloud}
          accessibilityLabel="Repeat last result aloud"
          accessibilityRole="button"
        >
          <Text style={styles.navIcon}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Camera Viewfinder */}
      <View style={styles.cameraContainer}>
        {isFocused ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            accessibilityLabel="Camera viewfinder. Point at text to read."
          />
        ) : (
          <View style={styles.camera} />
        )}

        {/* Scanning frame overlay */}
        <View style={styles.scanFrame} pointerEvents="none">
          {/* Corner TL */}
          <View style={[styles.corner, styles.cornerTL]} />
          {/* Corner TR */}
          <View style={[styles.corner, styles.cornerTR]} />
          {/* Corner BL */}
          <View style={[styles.corner, styles.cornerBL]} />
          {/* Corner BR */}
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Processing spinner overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>
              {status === 'capturing' ? '📷 Capturing…' : '🔍 Reading text…'}
            </Text>
          </View>
        )}

        {/* Status pill at bottom of camera */}
        <View style={styles.statusPillContainer} pointerEvents="none">
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isProcessing ? '#F59E0B' : '#22C55E' },
              ]}
            />
            <Text style={styles.statusPillText}>
              {isProcessing ? 'Analyzing image…' : 'Aim at sign or text'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Show OCR result if available */}
        {result ? (
          <>
            <TextResultCard
              result={result}
              onReadAloud={readResultAloud}
              onClear={clearResult}
            />
            <AccessibleButton
              label="Scan Again"
              hint="Take a new photo to detect more text"
              variant="secondary"
              size="lg"
              style={styles.scanButton}
              onPress={captureAndRead}
            />
          </>
        ) : (
          <>
            {/* Primary capture button */}
            <View style={styles.captureSection}>
              <AccessibleButton
                label={isProcessing ? 'Reading…' : 'Read Text'}
                hint="Capture the current camera view and detect text"
                variant="primary"
                size="lg"
                loading={isProcessing}
                style={styles.captureButton}
                onPress={captureAndRead}
              />
              {canDescribe && (
                <AccessibleButton
                  label={isProcessing ? 'Looking…' : 'Describe Scene'}
                  hint="Take a photo and hear what is in front of the camera. Needs internet."
                  variant="secondary"
                  size="lg"
                  loading={isProcessing}
                  style={styles.captureButton}
                  onPress={() => captureAndDescribe()}
                />
              )}
            </View>

            {/* Error state */}
            {error && (
              <View style={styles.errorBox} accessible accessibilityRole="alert">
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Reading history */}
            {history.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Recent Scans:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {history.map((text, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.historyChip}
                      onPress={() => ttsService.speakImmediate(text)}
                      accessibilityLabel={`Recent scan: ${text.split('\n')[0]}`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.historyChipText} numberOfLines={1}>
                        {text.split('\n')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  navButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  scanFrame: {
    position: 'absolute',
    top: '15%',
    left: '8%',
    right: '8%',
    bottom: '20%',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  statusPillContainer: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: Typography.fontWeight.medium,
  },
  bottomPanel: {
    backgroundColor: '#0A0A0E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
    borderTopWidth: 1,
    borderColor: '#1E1E28',
  },
  captureSection: {
    alignItems: 'center',
    gap: 10,
  },
  captureButton: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 18,
  },
  scanButton: {
    marginHorizontal: 16,
    borderRadius: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 14,
    marginHorizontal: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  historySection: {
    paddingHorizontal: 16,
  },
  historyTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: 10,
  },
  historyChip: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 180,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  historyChipText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 16,
  },
});
