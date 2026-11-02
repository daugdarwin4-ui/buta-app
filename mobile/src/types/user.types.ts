import type { DetectionSourceSetting } from './detection.types';

/** Preferences stored on the device (there are no user accounts) */
export interface LocalSettings {
  tts_speed: number;
  tts_pitch: number;
  tts_language: string;
  haptic_intensity: 'low' | 'medium' | 'high';
  /** Phone camera, cane device, or both — depends on what the user carries */
  detection_source: DetectionSourceSetting;
  /** "Improve My AI": keep camera pictures the model was unsure about, for labelling on the PC */
  collect_training_photos: boolean;
  /** Name objects YOLO doesn't know (rice cooker, broom…) with Gemini every few seconds; uses internet */
  smart_identify: boolean;
  /** Object names the user taught, used as preferred names by the AI identifier */
  custom_object_names: string[];
}

export const DEFAULT_SETTINGS: LocalSettings = {
  tts_speed: 0.9,
  tts_pitch: 1.0,
  tts_language: 'en-PH',
  haptic_intensity: 'medium',
  detection_source: 'camera',
  collect_training_photos: false,
  smart_identify: true,
  custom_object_names: [],
};
