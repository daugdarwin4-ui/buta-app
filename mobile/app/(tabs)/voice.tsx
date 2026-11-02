import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { MIN_TOUCH_TARGET } from '../../src/constants/config';
import { useVoiceAssistant } from '../../src/hooks/useVoiceAssistant';
import { HELP_MESSAGE } from '../../src/services/voice/commandParser';
import { ttsService } from '../../src/services/tts/tts.service';

// Give the screen reader a moment to announce the screen before the mic opens
const AUTO_LISTEN_DELAY_MS = 900;

export default function VoiceAssistantScreen() {
  const {
    transcript,
    lastResponse,
    isListening,
    isProcessing,
    startListening,
    stopListening,
    cancelListening,
    executeCommand,
  } = useVoiceAssistant();
  const [textInput, setTextInput] = useState('');

  // Arriving here means the user wants to speak: open the mic automatically
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(startListening, AUTO_LISTEN_DELAY_MS);
      return () => {
        clearTimeout(timer);
        cancelListening();
      };
    }, [])
  );

  const handleTextSubmit = async () => {
    const phrase = textInput.trim();
    if (!phrase) return;
    setTextInput('');
    await executeCommand(phrase);
  };

  const micLabel = isListening
    ? '🔴 Listening… tap to finish'
    : isProcessing
    ? '⏳ Working on it…'
    : '🎙️ Tap to speak';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle} accessibilityRole="header">
          Voice Assistant
        </Text>
        <View style={{ width: MIN_TOUCH_TARGET }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Central Microphone Button */}
        <View style={styles.micSection}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isListening && styles.micButtonListening,
              isProcessing && styles.micButtonProcessing,
            ]}
            onPress={isListening ? stopListening : startListening}
            disabled={isProcessing}
            accessibilityLabel={isListening ? 'Listening. Tap to finish' : 'Speak a command'}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            <Text style={styles.micIcon}>{isListening ? '⏹' : '🎙️'}</Text>
          </TouchableOpacity>

          <Text style={[styles.micStateLabel, isListening && styles.micStateLabelListening]}>
            {micLabel}
          </Text>
        </View>

        {/* Live Heard Transcript Box */}
        {(isListening || isProcessing || transcript.length > 0) ? (
          <View style={styles.transcriptBox} accessible accessibilityLabel={`Heard: ${transcript || 'Listening…'}`}>
            <Text style={styles.transcriptLabel}>Heard Command:</Text>
            <Text style={styles.transcriptText}>
              {transcript || (isListening ? 'Listening to your microphone…' : '…')}
            </Text>
          </View>
        ) : null}

        {/* Assistant Response Box */}
        {lastResponse ? (
          <View style={styles.responseBox} accessible accessibilityLabel={`Response: ${lastResponse}`}>
            <Text style={styles.responseLabel}>GuideAI Response:</Text>
            <Text style={styles.responseText}>{lastResponse}</Text>
          </View>
        ) : null}

        {/* Google Keyboard Voice Typing Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Or type a command"
            placeholderTextColor="#6B7280"
            onSubmitEditing={handleTextSubmit}
            returnKeyType="send"
            accessibilityLabel="Type a command instead of speaking"
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleTextSubmit}
            accessibilityLabel="Send command"
            accessibilityRole="button"
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => ttsService.speakImmediate(HELP_MESSAGE)}
          accessibilityLabel="What can I say?"
          accessibilityHint="Lists the voice commands"
          accessibilityRole="button"
        >
          <Text style={styles.helpButtonText}>❓ What can I say?</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  backBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    alignItems: 'center',
  },
  micSection: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  micButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1C1C2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3A3A54',
    elevation: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    marginBottom: 12,
  },
  micButtonListening: {
    backgroundColor: '#3B0764',
    borderColor: '#A855F7',
    shadowOpacity: 0.8,
  },
  micButtonProcessing: {
    backgroundColor: '#0A0A2E',
    borderColor: '#818CF8',
  },
  micIcon: { fontSize: 46 },
  micStateLabel: {
    color: '#D1D5DB',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  micStateLabelListening: {
    color: '#C084FC',
  },
  transcriptBox: {
    width: '100%',
    backgroundColor: '#0F0F1A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    marginBottom: 12,
  },
  transcriptLabel: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  transcriptText: {
    color: '#E5E7EB',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    fontStyle: 'italic',
  },
  responseBox: {
    width: '100%',
    backgroundColor: '#11111A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262638',
    marginBottom: 12,
    gap: 6,
  },
  responseLabel: {
    color: '#A78BFA',
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  responseText: {
    color: '#F3F4F6',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#14141E',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#28283C',
    marginBottom: 16,
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 8,
  },
  sendButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpButton: {
    width: '100%',
    minHeight: MIN_TOUCH_TARGET + 16,
    borderRadius: 18,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
});
