import { useState, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import {
  SpeechRecognition,
  useSpeechRecognitionEvent,
} from '../services/voice/speechRecognition';
import { commandParser } from '../services/voice/commandParser';
import { nativeFeatureMissingMessage } from '../services/native/appEnvironment';
import { ttsService } from '../services/tts/tts.service';
import { hapticsService } from '../services/haptics/haptics.service';
import { gpsService } from '../services/navigation/gps.service';
import { useNavigationStore } from '../stores/navigationStore';
import { useDetectionStore } from '../stores/detectionStore';
import { geminiService } from '../services/ai/gemini.service';
import { NEARBY_PLACES } from '../constants/places';
import { spokenWarning } from '../services/detection/spokenWarning';
import type { ListeningState, ParsedCommand } from '../types/voice.types';

// English (Philippines) understands local accents and many Taglish words; en-US is the fallback
const PRIMARY_LANG = 'en-PH';
const FALLBACK_LANG = 'en-US';

/** Spoken explanation for each recognizer failure, so a blind user never gets silence */
const ERROR_MESSAGES: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'no-speech': "I didn't hear anything. Tap the microphone and try again.",
  'speech-timeout': "I didn't hear anything. Tap the microphone and try again.",
  'not-allowed': 'Microphone permission is needed for voice commands. Please allow it in your phone settings.',
  network: 'Voice recognition needs internet. You can download offline English speech in the Google app settings.',
  'service-not-allowed': 'Voice recognition is not available. Please install or update the Google app.',
  'audio-capture': 'The microphone is not working. Please try again.',
  busy: 'Voice recognition is busy. Please try again in a moment.',
};

/** Offline keyword match this sure (the keyword is most of what was said) is acted on directly */
const OFFLINE_CONFIDENT = 0.8;

/** Unmistakable emergency words: always handled on the device at once, never sent to the AI */
const URGENT_WORDS = /\b(sos|emergency|saklolo|tulong|tulungan)\b/i;

/**
 * Should this request be understood by the built-in keywords alone (instant, works offline)?
 * Everything else — free-form speech, questions, long sentences that merely contain a keyword —
 * is better understood by the AI assistant, with the keyword result as the fallback.
 */
export function shouldUseOfflineOnly(text: string, offline: ParsedCommand): boolean {
  if (URGENT_WORDS.test(text) || offline.intent === 'STOP') return true;
  if (offline.intent === 'UNKNOWN') return false;
  // "navigate to rizal boulevard": the destination was already extracted
  if (offline.intent === 'NAVIGATE' && offline.parameter) return true;
  return offline.confidence >= OFFLINE_CONFIDENT;
}

/**
 * Voice assistant backed by the phone's native speech recognizer (Android SpeechRecognizer),
 * with Gemini understanding free-form requests when it is available.
 */
export function useVoiceAssistant() {
  const [listeningState, setListeningState] = useState<ListeningState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null);
  const [lastResponse, setLastResponse] = useState('');
  const langRef = useRef(PRIMARY_LANG);
  const handledFinalRef = useRef(false);

  const { requestNavigation, setMuted } = useNavigationStore();

  const executeIntent = useCallback(
    async (command: ParsedCommand) => {
      switch (command.intent) {
        case 'NAVIGATE':
          if (command.parameter) requestNavigation(command.parameter);
          router.push('/(tabs)/navigation');
          break;
        case 'WHERE_AM_I':
          ttsService.speakImmediate(await gpsService.describeCurrentLocation());
          break;
        case 'READ_TEXT':
          router.push('/(tabs)/text-reader');
          break;
        case 'DETECT':
          router.push('/(tabs)/detection');
          break;
        case 'SOS':
          router.push('/emergency/sos');
          break;
        case 'SETTINGS':
          router.push('/settings');
          break;
        case 'PROFILE':
          router.push('/(tabs)/profile');
          break;
        case 'HOME':
          router.push('/(tabs)');
          break;
        case 'MUTE':
          setMuted(true);
          break;
        case 'UNMUTE':
          setMuted(false);
          break;
        case 'STOP':
          ttsService.stop();
          break;
        case 'REPEAT':
          ttsService.repeatLast();
          break;
        case 'DESCRIBE_SCENE':
          // The reader screen takes the photo; the timestamp makes repeated requests fire again
          router.push({ pathname: '/(tabs)/text-reader', params: { describe: String(Date.now()) } });
          break;
        default:
          // HELP, ANSWER and UNKNOWN are fully handled by the spoken response
          break;
      }
    },
    [requestNavigation, setMuted]
  );

  /** Parse a final transcript (spoken or typed) and act on it */
  const executeCommand = useCallback(
    async (text: string) => {
      const clean = text?.trim();
      if (!clean) return;
      setListeningState('processing');
      setTranscript(clean);

      let command = commandParser.parse(clean);
      let response = commandParser.getResponseMessage(command);
      await hapticsService.buttonPress();

      if (!shouldUseOfflineOnly(clean, command) && geminiService.isAvailable) {
        const { isActive, detections } = useDetectionStore.getState();
        const ai = await geminiService.understand(clean, {
          // The spoken form, so the assistant follows the same rule (no object names like "stairs")
          detections: isActive ? [...new Set(detections.map((d) => spokenWarning(d)))] : undefined,
          knownPlaces: NEARBY_PLACES,
        });
        // No answer (offline, limit reached, slow) or "no idea": keep the keyword result
        if (ai && ai.intent !== 'UNKNOWN') {
          command = { intent: ai.intent, confidence: 0.9, rawText: clean, parameter: ai.parameter };
          // Emergency wording is never left to the AI: it must say exactly what the app does
          response = ai.intent === 'SOS' ? commandParser.getResponseMessage(command) : ai.reply;
        }
      }
      setLastCommand(command);
      setLastResponse(response);

      // REPEAT replays the previous message instead of announcing itself
      if (command.intent !== 'REPEAT') ttsService.speakImmediate(response);

      // Brief pause so the confirmation starts before the screen changes
      setTimeout(async () => {
        await executeIntent(command);
        setListeningState('idle');
      }, 700);
    },
    [executeIntent]
  );

  // ── Native recognizer events ─────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    setTranscript(text);
    if (event.isFinal && text.trim() && !handledFinalRef.current) {
      handledFinalRef.current = true;
      executeCommand(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') {
      setListeningState('idle');
      return;
    }
    if (event.error === 'language-not-supported' && langRef.current !== FALLBACK_LANG) {
      langRef.current = FALLBACK_LANG;
      SpeechRecognition?.start({ lang: FALLBACK_LANG, interimResults: true });
      return;
    }
    setListeningState('idle');
    hapticsService.triggerForRisk('warning');
    ttsService.speakImmediate(ERROR_MESSAGES[event.error] ?? "Sorry, I couldn't understand. Please try again.");
  });

  useSpeechRecognitionEvent('end', () => {
    setListeningState((s) => (s === 'listening' ? 'idle' : s));
  });

  // ── Public API ───────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (listeningState === 'listening') return;

    if (!SpeechRecognition) {
      // Installed app was built before voice recognition was added: needs a rebuild
      ttsService.speakImmediate(
        `${nativeFeatureMissingMessage('Voice recognition')} You can type a command below for now.`
      );
      return;
    }

    const permission = await SpeechRecognition.requestPermissionsAsync();
    if (!permission.granted) {
      ttsService.speakImmediate(ERROR_MESSAGES['not-allowed']!);
      return;
    }
    if (!SpeechRecognition.isRecognitionAvailable()) {
      ttsService.speakImmediate(ERROR_MESSAGES['service-not-allowed']!);
      return;
    }

    // Silence our own voice first, or the microphone hears the app instead of the user
    ttsService.stop();
    handledFinalRef.current = false;
    setTranscript('');
    setListeningState('listening');
    await hapticsService.buttonPress();
    SpeechRecognition.start({ lang: langRef.current, interimResults: true, maxAlternatives: 1 });
  }, [listeningState]);

  /** Stop and use whatever was heard so far */
  const stopListening = useCallback(() => {
    SpeechRecognition?.stop();
  }, []);

  /** Stop and discard (e.g. leaving the screen) */
  const cancelListening = useCallback(() => {
    SpeechRecognition?.abort();
    setListeningState('idle');
    geminiService.resetConversation(); // a new visit starts a new conversation
  }, []);

  return {
    listeningState,
    transcript,
    lastCommand,
    lastResponse,
    startListening,
    stopListening,
    cancelListening,
    executeCommand,
    isListening: listeningState === 'listening',
    isProcessing: listeningState === 'processing',
  };
}
