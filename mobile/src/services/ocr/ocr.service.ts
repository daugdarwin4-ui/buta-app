import { NativeModules } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { nativeFeatureMissingMessage } from '../native/appEnvironment';

/** Thrown when the installed app was built before on-device text reading was added */
export class OcrUnavailableError extends Error {
  constructor() {
    super(nativeFeatureMissingMessage('Text reading'));
  }
}
import { OcrResult } from '../../types/ocr.types';

class OcrService {
  /**
   * Read text from a photo on the device with Google ML Kit (offline, no server needed).
   * Returns an empty result (never a fake sample) when no text is found.
   */
  async extractTextFromImage(imageUri: string): Promise<OcrResult> {
    if (!imageUri) {
      return { text: '', blocks: [], language: 'en' };
    }

    if (!NativeModules.TextRecognition) throw new OcrUnavailableError();
    const result = await TextRecognition.recognize(imageUri);
    return {
      text: result.text ?? '',
      blocks: result.blocks.map((b) => ({
        text: b.text,
        boundingBox: b.frame
          ? { x: b.frame.left, y: b.frame.top, width: b.frame.width, height: b.frame.height }
          : undefined,
      })),
      language: result.blocks[0]?.recognizedLanguages[0]?.languageCode ?? 'en',
    };
  }

  /**
   * Format extracted text for TTS announcement
   */
  formatForSpeech(result: OcrResult): string {
    const text = result.text?.trim();
    if (!text) return 'No text was detected in the image. Try moving closer or improving the lighting.';
    // Read each line as a separate sentence for cleaner TTS output
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    return `Text detected: ${lines.join('. ')}`;
  }
}

export const ocrService = new OcrService();
