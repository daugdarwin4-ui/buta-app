import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Over-the-air updates (EAS Update): which version is running, a manual "check for updates",
 * and a spoken notice after an update installs — the app otherwise updates silently, which a
 * blind user cannot notice.
 *
 * expo-updates is required lazily and every call is guarded, so development builds, Expo Go and
 * tests (where updates are disabled) simply report "not available" instead of failing.
 */

type UpdatesModule = typeof import('expo-updates');

function updatesModule(): UpdatesModule | null {
  try {
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

const LAST_UPDATE_KEY = 'guideai.lastUpdateId';

export interface UpdateInfo {
  /** e.g. "1.0.0" */
  appVersion: string;
  /** True in the installed app; false in development builds */
  enabled: boolean;
  /** Short id of the running update, or null when running the version built into the APK */
  updateId: string | null;
  /** When the running update was published */
  publishedAt: Date | null;
}

export function getUpdateInfo(): UpdateInfo {
  const Updates = updatesModule();
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  if (!Updates || !Updates.isEnabled) {
    return { appVersion, enabled: false, updateId: null, publishedAt: null };
  }
  const embedded = Updates.isEmbeddedLaunch;
  return {
    appVersion,
    enabled: true,
    updateId: !embedded && Updates.updateId ? Updates.updateId.slice(0, 8) : null,
    publishedAt: !embedded ? Updates.createdAt ?? null : null,
  };
}

/** One line for the screen and screen reader, e.g. "Version 1.0.0, updated 9 Oct 2026" */
export function describeVersion(info: UpdateInfo = getUpdateInfo()): string {
  if (!info.enabled) return `Version ${info.appVersion} (development build)`;
  if (!info.publishedAt) return `Version ${info.appVersion}, original install`;
  const date = info.publishedAt.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Version ${info.appVersion}, updated ${date}`;
}

export type UpdateCheckResult = 'up-to-date' | 'installing' | 'unavailable' | 'error';

/**
 * Check for a newer update now. If one exists it is downloaded and the app restarts into it
 * (the caller should announce that first). Never throws.
 */
export async function checkForUpdateNow(beforeRestart?: () => Promise<void> | void): Promise<UpdateCheckResult> {
  const Updates = updatesModule();
  if (!Updates || !Updates.isEnabled) return 'unavailable';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'up-to-date';
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return 'up-to-date';
    await beforeRestart?.();
    await Updates.reloadAsync();
    return 'installing';
  } catch (err) {
    console.warn('Update check failed:', err);
    return 'error';
  }
}

/**
 * True once after the app starts on an update it has not announced yet. Never throws.
 * The first launch after install only records the version (nothing new to announce).
 */
export async function consumeUpdateNotice(): Promise<boolean> {
  const Updates = updatesModule();
  if (!Updates || !Updates.isEnabled || !Updates.updateId) return false;
  try {
    const last = await AsyncStorage.getItem(LAST_UPDATE_KEY);
    if (last === Updates.updateId) return false;
    await AsyncStorage.setItem(LAST_UPDATE_KEY, Updates.updateId);
    return last !== null && !Updates.isEmbeddedLaunch;
  } catch {
    return false;
  }
}
