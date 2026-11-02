import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../src/constants/config';
import { AccessibleButton } from '../src/components/common/AccessibleButton';
import { useUserStore } from '../src/stores/userStore';
import { ttsService } from '../src/services/tts/tts.service';
import { MAX_SAMPLES, sampleCollector, type SampleInfo } from '../src/services/training/sampleCollector';

/** Newest pictures shown as thumbnails */
const PREVIEW_COUNT = 9;

/**
 * "Teach My AI": collect camera pictures the model was unsure about (or saw nothing in), copy
 * them to the PC, label them there and train the next model. Meant for a sighted helper or the
 * developer; every control still works with TalkBack.
 */
export default function ImproveAiScreen() {
  const { settings, updateSettings } = useUserStore();
  const enabled = settings.collect_training_photos;
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setSamples(sampleCollector.list()), []);
  useFocusEffect(refresh);
  useEffect(() => sampleCollector.subscribe(refresh), [refresh]);

  const toggle = () => {
    const next = !enabled;
    updateSettings({ collect_training_photos: next }).catch((err) => console.warn('Could not save settings:', err));
    ttsService.speakImmediate(
      next
        ? 'Saving pictures for training is on. While obstacle detection runs, GuideAI keeps pictures it was unsure about.'
        : 'Saving pictures for training is off.'
    );
  };

  const exportSamples = async () => {
    if (busy) return;
    if (samples.length === 0) {
      ttsService.speakImmediate('There are no pictures to copy yet.');
      return;
    }
    setBusy(true);
    ttsService.speakImmediate('Choose a folder, for example Download, then tap Use this folder.');
    try {
      const result = await sampleCollector.exportToPickedFolder();
      if (result === null) {
        ttsService.speakImmediate('Copy cancelled.');
      } else {
        ttsService.speakImmediate(`Copied ${result.copied} pictures to the folder ${result.folder}.`);
        Alert.alert(
          'Pictures copied',
          `${result.copied} pictures are in the folder "${result.folder}". Connect the phone to the computer by USB and copy that folder to the PC.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ttsService.speakImmediate('Could not copy the pictures.');
      Alert.alert('Could not copy the pictures', message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = () => {
    Alert.alert('Delete all pictures?', `This deletes the ${samples.length} saved pictures from the phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          sampleCollector.clear();
          ttsService.speakImmediate('All training pictures deleted.');
        },
      },
    ]);
  };

  const available = sampleCollector.isAvailable;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">Teach My AI</Text>
        <View style={{ width: MIN_TOUCH_TARGET }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Teach GuideAI about obstacles it misses. While obstacle detection runs, it can keep pictures it was unsure
          about, plus one picture a minute. While this is on, a Teach button also appears on the camera screen: tap it, then type what the object is. A helper then checks the pictures on the computer and trains a new model.
        </Text>

        {!available && (
          <Text style={styles.warning}>Saving pictures is not available in this version of the app.</Text>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.toggle, enabled && styles.toggleOn]}
            onPress={toggle}
            disabled={!available}
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled, disabled: !available }}
            accessibilityLabel="Save pictures for training"
            accessibilityHint="Keeps camera pictures the AI was unsure about, on this phone only"
          >
            <View style={styles.toggleTextBox}>
              <Text style={styles.toggleLabel}>Save pictures for training</Text>
              <Text style={styles.toggleSub}>{enabled ? 'On' : 'Off'} · pictures stay on this phone</Text>
            </View>
            <Text style={styles.toggleState}>{enabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          <Text style={styles.count} accessibilityLabel={`${samples.length} of ${MAX_SAMPLES} pictures saved`}>
            {samples.length} / {MAX_SAMPLES} pictures saved
          </Text>

          {samples.length > 0 && (
            <View style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {samples.slice(0, PREVIEW_COUNT).map((s) => (
                <View key={s.name} style={styles.thumbBox}>
                  <Image source={{ uri: s.uri }} style={styles.thumb} resizeMode="cover" />
                  <Text style={styles.thumbTag}>{s.name.includes('_manual') ? 'taught' : s.name.includes('_unsure') ? 'unsure' : 'check'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send to the computer</Text>
          <AccessibleButton
            label={busy ? 'Copying…' : 'Copy Pictures to a Folder'}
            hint="Choose a folder such as Download, then copy it to the computer by USB"
            variant="secondary"
            size="md"
            loading={busy}
            onPress={exportSamples}
          />
          <Text style={styles.steps}>
            On the computer:{'\n'}
            1. Copy the GuideAI-samples folder from the phone.{'\n'}
            2. Run model/datasets/import_phone_samples.py on it.{'\n'}
            3. Check and fix every box in a labelling tool. The AI's guesses are only suggestions.{'\n'}
            4. Retrain, then test the new model before it goes to the app.
          </Text>
        </View>

        {samples.length > 0 && (
          <AccessibleButton
            label="Delete All Pictures"
            hint="Removes the saved training pictures from this phone"
            variant="secondary"
            size="md"
            onPress={deleteAll}
          />
        )}
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
  backBtn: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary },
  pageTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 16 },
  intro: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  warning: { fontSize: Typography.fontSize.sm, color: '#FCA5A5', fontWeight: Typography.fontWeight.semibold },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionTitle: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    padding: 14,
    minHeight: MIN_TOUCH_TARGET + 16,
  },
  toggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleTextBox: { flex: 1 },
  toggleLabel: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold, color: Colors.textPrimary },
  toggleSub: { fontSize: Typography.fontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  toggleState: { fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.extrabold, color: Colors.textPrimary },
  count: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, fontWeight: Typography.fontWeight.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbBox: { width: '31.5%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  thumbTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  steps: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
});
