import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { AccessibleButton } from '../src/components/common/AccessibleButton';
import { useUserStore } from '../src/stores/userStore';
import { ttsService } from '../src/services/tts/tts.service';
import { hapticsService } from '../src/services/haptics/haptics.service';
import { MIN_TOUCH_TARGET } from '../src/constants/config';
import type { LocalSettings } from '../src/types/user.types';
import type { DetectionSourceSetting } from '../src/types/detection.types';
import { checkForUpdateNow, describeVersion } from '../src/services/updates/appUpdates';

type HapticLevel = LocalSettings['haptic_intensity'];

const DETECTION_SOURCES: { value: DetectionSourceSetting; label: string; description: string }[] = [
  { value: 'camera', label: 'Phone camera', description: 'Wear the phone on your chest, camera facing forward.' },
  { value: 'cane', label: 'Cane device', description: 'Uses the sensors on your GuideAI cane.' },
  { value: 'both', label: 'Both', description: 'Phone camera and cane together for the most warnings.' },
];

export default function SettingsScreen() {
  const { settings, updateSettings } = useUserStore();

  const [ttsSpeed, setTtsSpeed] = useState(settings.tts_speed);
  const [voiceLang, setVoiceLang] = useState(settings.tts_language);
  const [hapticLevel, setHapticLevel] = useState<HapticLevel>(settings.haptic_intensity);
  const [detectionSource, setDetectionSource] = useState<DetectionSourceSetting>(settings.detection_source);
  const [smartIdentify, setSmartIdentify] = useState(settings.smart_identify);
  // Every change is applied and saved at once: a blind user should not have to find a Save button.
  // (The root layout applies the saved values to the speech and vibration services.)
  const save = (updates: Partial<LocalSettings>) => {
    updateSettings(updates).catch((err) => console.warn('Could not save settings:', err));
  };

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    ttsService.speakImmediate('Checking for updates.');
    try {
      const result = await checkForUpdateNow(async () => {
        ttsService.speakImmediate('Update found. GuideAI will restart now.');
        await new Promise((resolve) => setTimeout(resolve, 2500)); // let the message finish
      });
      if (result === 'up-to-date') ttsService.speakImmediate('GuideAI is up to date.');
      else if (result === 'unavailable') ttsService.speakImmediate('Updates are only available in the installed app.');
      else if (result === 'error') ttsService.speakImmediate('Could not check for updates. Check your internet connection.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const previewTTS = () => {
    ttsService.speakImmediate('This is how GuideAI will speak to you.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">Settings</Text>
        <View style={{ width: MIN_TOUCH_TARGET }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Voice / TTS ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔊 Voice & Speech</Text>

          <Text style={styles.fieldLabel}>Speech Speed</Text>
          <View style={styles.segmentRow}>
            {([0.7, 0.9, 1.1, 1.3] as number[]).map((rate) => (
              <TouchableOpacity
                key={rate}
                style={[styles.segment, ttsSpeed === rate && styles.segmentActive]}
                onPress={() => {
                  setTtsSpeed(rate);
                  ttsService.setRate(rate);
                  save({ tts_speed: rate });
                  ttsService.speakImmediate(`Speed ${rate}.`);
                }}
                accessibilityLabel={`Speed ${rate}x`}
                accessibilityRole="button"
                accessibilityState={{ selected: ttsSpeed === rate }}
              >
                <Text style={[styles.segmentText, ttsSpeed === rate && styles.segmentTextActive]}>
                  {rate}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Voice Accent / Language</Text>
          <View style={styles.voiceGrid}>
            {[
              { code: 'en-PH', label: '🇵🇭 Philippines', spoken: 'Philippine' },
              { code: 'en-US', label: '🇺🇸 American', spoken: 'American' },
              { code: 'en-GB', label: '🇬🇧 British', spoken: 'British' },
              { code: 'en-IN', label: '🇮🇳 Indian', spoken: 'Indian' },
            ].map((v) => (
              <TouchableOpacity
                key={v.code}
                style={[styles.segment, (voiceLang === v.code) && styles.segmentActive, styles.voiceOption]}
                onPress={() => {
                  setVoiceLang(v.code);
                  ttsService.setLanguage(v.code);
                  save({ tts_language: v.code });
                  ttsService.speakImmediate(`Voice changed to ${v.spoken} English.`);
                }}
                accessibilityLabel={`${v.spoken} English voice`}
                accessibilityRole="button"
                accessibilityState={{ selected: voiceLang === v.code }}
              >
                <Text style={[styles.segmentText, voiceLang === v.code && styles.segmentTextActive]} numberOfLines={1}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <AccessibleButton
            label="Preview Voice"
            hint="Hear a sample of the selected voice"
            variant="secondary"
            size="sm"
            style={styles.previewButton}
            onPress={previewTTS}
          />
        </View>

        {/* ── Haptics ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📳 Vibration Alerts</Text>
          <Text style={styles.fieldLabel}>Haptic Intensity</Text>
          <View style={styles.segmentRow}>
            {(['low', 'medium', 'high'] as HapticLevel[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.segment, hapticLevel === level && styles.segmentActive, styles.segmentFlex]}
                onPress={() => {
                  // Apply and demonstrate immediately, like the speed buttons do
                  setHapticLevel(level);
                  hapticsService.setIntensity(level);
                  save({ haptic_intensity: level });
                  hapticsService.triggerForRisk('warning');
                  ttsService.speakImmediate(`Vibration ${level}.`);
                }}
                accessibilityLabel={`Haptic ${level}`}
                accessibilityRole="button"
                accessibilityState={{ selected: hapticLevel === level }}
              >
                <Text
                  style={[styles.segmentText, hapticLevel === level && styles.segmentTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Obstacle detection source ─────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🦯 Obstacle Detection</Text>
          <Text style={styles.fieldLabel}>Detect obstacles using</Text>
          {DETECTION_SOURCES.map((opt) => {
            const selected = detectionSource === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sourceOption, selected && styles.segmentActive]}
                onPress={() => {
                  setDetectionSource(opt.value);
                  save({ detection_source: opt.value });
                  ttsService.speakImmediate(`${opt.label}. ${opt.description}`);
                }}
                accessibilityLabel={`${opt.label}. ${opt.description}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sourceLabel, selected && styles.segmentTextActive]}>{opt.label}</Text>
                <Text style={[styles.sourceDesc, selected && styles.segmentTextActive]}>{opt.description}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.sourceOption, smartIdentify && styles.segmentActive]}
            onPress={() => {
              const next = !smartIdentify;
              setSmartIdentify(next);
              save({ smart_identify: next });
              ttsService.speakImmediate(
                next
                  ? 'AI object names on. Every few seconds, when online, the camera picture is sent to Google Gemini to name objects. Hazard alerts still work offline.'
                  : 'AI object names off. Only the built-in detector is used.'
              );
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: smartIdentify }}
            accessibilityLabel="AI object names"
            accessibilityHint="Names objects the built-in detector does not know, using the internet"
          >
            <Text style={[styles.sourceLabel, smartIdentify && styles.segmentTextActive]}>
              AI object names: {smartIdentify ? 'On' : 'Off'}
            </Text>
            <Text style={[styles.sourceDesc, smartIdentify && styles.segmentTextActive]}>
              Names objects the built-in detector doesn't know (rice cooker, broom…). Sends a camera picture to
              Google Gemini every few seconds when online. Hazard alerts always work offline.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/improve-ai' as never)}
            accessibilityLabel={`Teach My AI. Saving training pictures is ${settings.collect_training_photos ? 'on' : 'off'}.`}
            accessibilityHint="Save and name pictures of objects, to train a better model"
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Teach My AI</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.autoSaveNote}>Changes are saved automatically.</Text>

        {/* ── Account ───────────────────────────────── */}
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>👤 Account</Text>
          {[
            { label: 'Emergency Contacts', hint: 'Add or remove people who get your SOS alert', route: '/emergency/contacts' },
            { label: 'Your Name', hint: 'Your name is included in SOS text messages', route: '/(tabs)/profile' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.linkRow}
              onPress={() => router.push(item.route as never)}
              accessibilityLabel={item.label}
              accessibilityHint={item.hint}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>{item.label}</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── App version & updates ─────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📲 App Version</Text>
          <Text style={styles.fieldLabel} accessibilityLabel={describeVersion()}>
            {describeVersion()}
          </Text>
          <AccessibleButton
            label={checkingUpdate ? 'Checking for updates…' : 'Check for Updates'}
            hint="Downloads the newest version of GuideAI and restarts the app"
            variant="secondary"
            size="md"
            loading={checkingUpdate}
            onPress={handleCheckUpdate}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 24, color: Colors.textPrimary },
  pageTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Two per row, so full names fit on one line at any font size
  voiceOption: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  autoSaveNote: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 12,
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentFlex: { flex: 1 },
  segmentActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  segmentTextActive: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
  },
  previewButton: { marginTop: 14, alignSelf: 'flex-start' },
  sourceOption: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    padding: 14,
    marginBottom: 10,
    minHeight: MIN_TOUCH_TARGET + 16,
  },
  sourceLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  sourceDesc: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET + 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  linkText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  linkArrow: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  saveButton: { width: '100%', borderRadius: 16 },
});
