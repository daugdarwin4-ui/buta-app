import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { AccessibleButton } from '../../src/components/common/AccessibleButton';
import { useUserStore } from '../../src/stores/userStore';
import { ttsService } from '../../src/services/tts/tts.service';
import { hapticsService } from '../../src/services/haptics/haptics.service';

/**
 * The user's name, stored on this device. It is included in SOS text messages
 * so contacts know who needs help.
 */
export default function ProfileScreen() {
  const { name, setName } = useUserStore();
  const [draft, setDraft] = useState(name);

  const handleSave = async () => {
    await setName(draft);
    await hapticsService.success();
    ttsService.speak(
      draft.trim() ? `Name saved as ${draft.trim()}.` : 'Name cleared.',
      'info'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">
          Your Name
        </Text>
        <View style={{ width: MIN_TOUCH_TARGET }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.explainer}>
          Your name is included in emergency text messages so your contacts know who needs help.
          It is saved only on this phone.
        </Text>

        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Your full name"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          accessibilityLabel="Your full name"
          accessibilityHint="Type or dictate your name, then tap Save Name"
        />

        <AccessibleButton
          label="Save Name"
          hint="Saves your name on this phone"
          variant="primary"
          size="lg"
          style={styles.saveButton}
          onPress={handleSave}
        />

        <Text style={styles.disclaimer} accessibilityRole="text">
          ⚠️ GuideAI is an assistive tool only. AI detection and GPS navigation do not guarantee a safe
          environment. Always use your own judgement and your cane.
        </Text>
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
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 20 },
  explainer: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.md * 1.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    minHeight: MIN_TOUCH_TARGET + 12,
  },
  saveButton: { width: '100%', borderRadius: 16 },
  disclaimer: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.6,
    marginTop: 12,
  },
});
