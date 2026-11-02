import Constants from 'expo-constants';

/**
 * True inside the Expo Go app, which cannot load GuideAI's own native features.
 * (executionEnvironment can't be used: it reports the same value for Expo Go and dev-client builds.)
 */
export const isExpoGo = Constants.expoGoConfig != null;

/**
 * Spoken explanation when a native feature (voice, text reading, direct SMS) is missing.
 * The usual cause during development is opening the project in Expo Go instead of the GuideAI app.
 */
export function nativeFeatureMissingMessage(feature: string): string {
  return isExpoGo
    ? `${feature} does not work inside the Expo Go app. Please open the GuideAI app instead.`
    : `${feature} is not installed in this version of the app. Please install the latest build.`;
}
