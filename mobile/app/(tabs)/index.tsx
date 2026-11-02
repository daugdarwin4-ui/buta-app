import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { hapticsService } from '../../src/services/haptics/haptics.service';
import { ttsService } from '../../src/services/tts/tts.service';
import { gpsService } from '../../src/services/navigation/gps.service';

interface HomeAction {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  color: string;
  onPress: () => void | Promise<void>;
}

export default function HomeScreen() {
  const [locating, setLocating] = useState(false);

  // Short spoken orientation every time the user lands on Home
  useFocusEffect(
    useCallback(() => {
      ttsService.speak('Home.', 'info');
    }, [])
  );

  const handleWhereAmI = async () => {
    if (locating) return;
    setLocating(true);
    ttsService.speakImmediate('Finding your location.');
    try {
      ttsService.speakImmediate(await gpsService.describeCurrentLocation());
    } finally {
      setLocating(false);
    }
  };

  const ACTIONS: HomeAction[] = [
    {
      id: 'detect',
      label: 'Detect Obstacles',
      emoji: '👁️',
      hint: 'Start hazard and obstacle alerts',
      color: Colors.primary,
      onPress: () => router.push('/(tabs)/detection'),
    },
    {
      id: 'navigate',
      label: 'Navigate',
      emoji: '🧭',
      hint: 'Get spoken walking directions to a place',
      color: Colors.primary,
      onPress: () => router.push('/(tabs)/navigation'),
    },
    {
      id: 'whereami',
      label: locating ? 'Locating…' : 'Where Am I?',
      emoji: '📍',
      hint: 'Speak your current street and area',
      color: Colors.primary,
      onPress: handleWhereAmI,
    },
    {
      id: 'read',
      label: 'Read Text',
      emoji: '📖',
      hint: 'Use the camera to read a sign or label aloud',
      color: Colors.primary,
      onPress: () => router.push('/(tabs)/text-reader'),
    },
  ];

  const handleAction = async (action: HomeAction) => {
    await hapticsService.buttonPress();
    await action.onPress();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            GuideAI
          </Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            accessibilityHint="Voice speed, vibration, emergency contacts and account"
            accessibilityRole="button"
          >
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Primary: voice command. Largest target, first in reading order. */}
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={async () => {
            await hapticsService.buttonPress();
            router.push('/(tabs)/voice');
          }}
          accessibilityLabel="Voice command"
          accessibilityHint="Opens the voice assistant so you can speak a command"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.voiceIcon}>🎤</Text>
          <Text style={styles.voiceLabel}>Voice Command</Text>
        </TouchableOpacity>

        {/* Main actions, one per row for predictable swipe order */}
        <View style={styles.list}>
          {ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionButton, { borderColor: action.color }]}
              onPress={() => handleAction(action)}
              accessibilityLabel={action.label}
              accessibilityHint={action.hint}
              accessibilityRole="button"
              activeOpacity={0.75}
            >
              <Text style={styles.actionEmoji}>{action.emoji}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.repeatButton}
          onPress={() => ttsService.repeatLast()}
          accessibilityLabel="Repeat last message"
          accessibilityRole="button"
        >
          <Text style={styles.repeatText}>🔊 Repeat last message</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Emergency SOS is pinned: always on screen, never hidden below the scroll */}
      <View style={styles.sosBar}>
        <TouchableOpacity
          style={styles.sosButton}
          onPress={async () => {
            await hapticsService.buttonPress();
            router.push('/emergency/sos');
          }}
          accessibilityLabel="Emergency SOS"
          accessibilityHint="Open emergency alert for your contacts"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.actionEmoji}>🆘</Text>
          <Text style={styles.sosLabel}>Emergency SOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  headerButton: {
    width: MIN_TOUCH_TARGET + 8,
    height: MIN_TOUCH_TARGET + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 26,
  },
  voiceButton: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  voiceIcon: {
    fontSize: 40,
  },
  voiceLabel: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.white,
  },
  list: {
    gap: 12,
  },
  sosBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: Colors.danger,
  },
  sosLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.white,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 76,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: Colors.surface,
  },
  actionEmoji: {
    fontSize: 30,
  },
  actionLabel: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  repeatButton: {
    marginTop: 14,
    minHeight: MIN_TOUCH_TARGET + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repeatText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textSecondary,
  },
});
