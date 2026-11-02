import { requireOptionalNativeModule } from 'expo';
import type * as SpeechLib from 'expo-speech-recognition';

// expo-speech-recognition throws on import if its native code is missing (an app binary built
// before it was added). Load it only when the native module exists, so the Voice screen still
// opens and can tell the user what is wrong.
const lib: typeof SpeechLib | null = requireOptionalNativeModule('ExpoSpeechRecognition')
  ? require('expo-speech-recognition')
  : null;

/** Native recognizer, or null when this app build does not include it */
export const SpeechRecognition = lib?.ExpoSpeechRecognitionModule ?? null;

/** Same as the library hook; a no-op when the native module is missing (stable per app run) */
export const useSpeechRecognitionEvent: typeof SpeechLib.useSpeechRecognitionEvent = lib
  ? lib.useSpeechRecognitionEvent
  : () => {};
