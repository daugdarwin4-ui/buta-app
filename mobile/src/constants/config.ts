/** Minimum touch target size in pixels (48dp × 48dp for accessibility) */
export const MIN_TOUCH_TARGET = 48;

/** API base URL — dynamically uses EXPO_PUBLIC_API_BASE_URL or local Wi-Fi IP for phone access */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__ ? 'http://192.168.1.35:3000' : 'https://your-api.guideai.app');

/** App version */
export const APP_VERSION = '1.0.0';

/** App display name */
export const APP_NAME = 'GuideAI';
export const APP_TAGLINE = 'Smart Navigation Assistant';

/** Onboarding pages count */
export const ONBOARDING_PAGES = 3;

/** Default TTS settings — Indian English voice */
export const DEFAULT_TTS_RATE = 0.95;
export const DEFAULT_TTS_PITCH = 1.0;
export const DEFAULT_TTS_LANGUAGE = 'en-IN'; // Indian English voice
export const DEFAULT_STT_LOCALE = 'en-IN';   // Indian English speech recognition
