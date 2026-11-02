import { requireOptionalNativeModule } from 'expo';

interface PermissionResponse {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

interface DirectSmsNativeModule {
  isAvailable(): boolean;
  requestPermissionAsync(): Promise<PermissionResponse>;
  /** Resolves once Android reports the message as sent; rejects if it fails */
  sendSmsAsync(phoneNumber: string, message: string): Promise<boolean>;
}

/**
 * Native direct-SMS module (Android only). Null on iOS, web, or a build made
 * before this module was added — callers must handle that.
 */
export const DirectSms = requireOptionalNativeModule<DirectSmsNativeModule>('DirectSms');
