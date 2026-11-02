import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type LocalSettings } from '../types/user.types';

const STORAGE_KEY = '@guideai_user';

interface PersistedUser {
  deviceId: string;
  name: string;
  settings: LocalSettings;
  hasOnboarded: boolean;
  settingsVersion?: number;
}

interface UserState extends PersistedUser {
  isLoaded: boolean;

  load: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  updateSettings: (updates: Partial<LocalSettings>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

/** Random identifier for this install, used only to group SOS events in the server log */
function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Bump when a saved setting needs a one-time change on existing installs (see load) */
const SETTINGS_VERSION = 2;

/**
 * The app has no accounts. Everything personal (name, settings) lives on the device.
 */
export const useUserStore = create<UserState>((set, get) => {
  const persist = async () => {
    const { deviceId, name, settings, hasOnboarded } = get();
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ deviceId, name, settings, hasOnboarded, settingsVersion: SETTINGS_VERSION } satisfies PersistedUser)
      );
    } catch (e) {
      console.warn('Could not save user data:', e);
    }
  };

  return {
    deviceId: '',
    name: '',
    settings: DEFAULT_SETTINGS,
    hasOnboarded: true,
    isLoaded: false,

    load: async () => {
      let stored: Partial<PersistedUser> = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch (e) {
        console.warn('Could not read user data:', e);
      }
      const settings = { ...DEFAULT_SETTINGS, ...stored.settings };
      // Version 2 changed the default voice from Indian to Philippine English. Installs saved
      // before that still hold the old default (never a deliberate choice then): move them once.
      const outdated = !!stored.deviceId && (stored.settingsVersion ?? 1) < SETTINGS_VERSION;
      if (outdated && settings.tts_language === 'en-IN') settings.tts_language = DEFAULT_SETTINGS.tts_language;
      set({
        deviceId: stored.deviceId || generateDeviceId(),
        name: stored.name ?? '',
        settings,
        hasOnboarded: stored.hasOnboarded ?? true,
        isLoaded: true,
      });
      if (!stored.deviceId || outdated) await persist();
    },

    setName: async (name) => {
      set({ name: name.trim() });
      await persist();
    },

    updateSettings: async (updates) => {
      set({ settings: { ...get().settings, ...updates } });
      await persist();
    },

    completeOnboarding: async () => {
      set({ hasOnboarded: true });
      await persist();
    },
  };
});
