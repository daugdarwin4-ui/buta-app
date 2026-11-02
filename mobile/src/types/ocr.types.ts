export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
  language?: string;
  confidence?: number;
}

export interface OcrBlock {
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type OcrStatus =
  | 'idle'
  | 'ready'       // Camera ready, no capture yet
  | 'capturing'   // Photo being taken
  | 'processing'  // Recognising text on the device
  | 'result'      // Text available
  | 'error';

export interface OcrState {
  status: OcrStatus;
  result: OcrResult | null;
  error: string | null;
  history: string[];
}
