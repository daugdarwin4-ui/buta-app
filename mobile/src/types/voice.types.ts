export type VoiceCommandIntent =
  | 'NAVIGATE'
  | 'READ_TEXT'
  | 'DETECT'
  | 'SOS'
  | 'STOP'
  | 'MUTE'
  | 'UNMUTE'
  | 'SETTINGS'
  | 'PROFILE'
  | 'HOME'
  | 'REPEAT'
  | 'WHERE_AM_I'
  | 'HELP'
  /** Free-form question answered by the AI assistant; no app action */
  | 'ANSWER'
  /** Take a photo and describe what the camera sees (AI assistant) */
  | 'DESCRIBE_SCENE'
  | 'UNKNOWN';

export interface ParsedCommand {
  intent: VoiceCommandIntent;
  confidence: number;
  rawText: string;
  parameter?: string; // e.g. destination for NAVIGATE
}

export interface VoiceCommandResponse {
  message: string;
  action?: () => void;
}

export type ListeningState = 'idle' | 'listening' | 'processing' | 'responding';
