import { requireOptionalNativeModule } from 'expo';
import type * as KeepAwakeLib from 'expo-keep-awake';

// expo-keep-awake throws on import if its native code is missing (an app binary built before it
// was added). Load it only when the native module exists so screens never crash because of it.
const lib: typeof KeepAwakeLib | null = requireOptionalNativeModule('ExpoKeepAwake')
  ? require('expo-keep-awake')
  : null;

/** Keeps the screen on while guiding; Android pauses the app when the screen locks */
export const keepAwake = {
  activate(tag: string) {
    lib?.activateKeepAwakeAsync(tag).catch(() => {});
  },
  deactivate(tag: string) {
    lib?.deactivateKeepAwake(tag).catch(() => {});
  },
};
