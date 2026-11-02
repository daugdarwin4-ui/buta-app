import axios from 'axios';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { env } from '../config/env';

export interface OcrBlock {
  text: string;
}

export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
  language?: string;
  confidence?: number;
}

class OcrService {
  /**
   * Extract text from a base64 image with professional contrast enhancement
   * and intelligent noise/gibberish filtering.
   */
  async extractText(base64Image: string): Promise<OcrResult> {
    const apiKey = env.GOOGLE_CLOUD_VISION_API_KEY;
    const isConfigured = apiKey && !apiKey.includes('your-google-cloud-vision') && apiKey.length > 20;

    if (isConfigured && base64Image) {
      try {
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
        const body = {
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 1 },
                { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
              ],
            },
          ],
        };

        const response = await axios.post(url, body, { timeout: 8000 });
        const responseBody = response.data?.responses?.[0];
        const fullText =
          responseBody?.fullTextAnnotation?.text ||
          responseBody?.textAnnotations?.[0]?.description ||
          '';

        const blocks = (responseBody?.textAnnotations || [])
          .slice(1, 20)
          .map((a: any) => ({ text: a.description || '' }));

        const detectedLanguage =
          responseBody?.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode;

        if (fullText.trim()) {
          const cleaned = this._cleanExtractedText(fullText.trim());
          return {
            text: cleaned,
            blocks,
            language: detectedLanguage || 'en',
            confidence: 0.96,
          };
        }
      } catch (err) {
        console.warn('Google Cloud Vision API failed, falling back to enhanced Tesseract.js:', err instanceof Error ? err.message : err);
      }
    }

    // High-Accuracy Preprocessed Tesseract.js OCR
    return this._tesseractEnhanced(base64Image);
  }

  /**
   * Enhanced Tesseract OCR with sharp image normalization and word-confidence filtering
   */
  private async _tesseractEnhanced(base64Image: string): Promise<OcrResult> {
    if (!base64Image) {
      return { text: '', blocks: [], language: 'en', confidence: 0 };
    }

    try {
      // 1. Image Preprocessing: Grayscale + Histogram Normalization + Sharpen
      const rawBuffer = Buffer.from(base64Image, 'base64');
      const processedBuffer = await sharp(rawBuffer)
        .resize({ width: 1800, withoutEnlargement: true })
        .grayscale()
        .normalize() // Boosts contrast between letters and background
        .sharpen({ sigma: 1.2 })
        .toBuffer();

      // 2. Initialize Tesseract Worker with sign & document parameters
      const worker = await createWorker('eng', 1, {
        logger: () => {},
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:;!?"-$%&/()+-@#',
        preserve_interword_spaces: '1',
      });

      const { data } = await worker.recognize(processedBuffer);
      await worker.terminate();

      // 3. Smart Word-Level Confidence & Gibberish Filtering
      const cleanWords: string[] = [];
      const cleanBlocks: OcrBlock[] = [];

      const pageData = data as any;
      if (pageData.words && Array.isArray(pageData.words)) {
        for (const w of pageData.words) {
          const rawWord = (w.text || '').trim();
          const conf = w.confidence ?? 0;

          // Reject low-confidence artifact words (< 52% confidence)
          if (conf < 52 && rawWord.length <= 3) continue;

          // Clean non-alphanumeric noise at edges
          const cleanedWord = rawWord.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

          // Discard single stray consonants (e.g. isolated 'x', 'q', 'j', 'z', 'b' from image noise)
          if (cleanedWord.length === 1 && !['a', 'i', 'A', 'I', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(cleanedWord)) {
            continue;
          }

          if (cleanedWord.length > 0) {
            cleanWords.push(rawWord);
          }
        }
      }

      // Reconstruct clean lines
      const rawLines = (data.text || '').split('\n');
      const cleanLines: string[] = [];

      for (const line of rawLines) {
        const cleanedLine = this._cleanLine(line);
        if (cleanedLine.length >= 2) {
          cleanLines.push(cleanedLine);
          cleanBlocks.push({ text: cleanedLine });
        }
      }

      const finalText = cleanLines.join('\n').trim();
      const avgConfidence = data.confidence ? Math.round(data.confidence) / 100 : 0.85;

      return {
        text: finalText || cleanWords.join(' ').trim(),
        blocks: cleanBlocks,
        language: 'en',
        confidence: avgConfidence,
      };
    } catch (err) {
      console.warn('Enhanced Tesseract OCR failed:', err instanceof Error ? err.message : err);
      return { text: '', blocks: [], language: 'en', confidence: 0 };
    }
  }

  /**
   * Clean and normalize a single text line
   */
  private _cleanLine(line: string): string {
    return line
      .replace(/[|~_`^{}\\]/g, ' ') // Remove common OCR noise symbols
      .replace(/\s+/g, ' ')         // Collapse multiple spaces
      .trim();
  }

  /**
   * Clean full extracted text
   */
  private _cleanExtractedText(text: string): string {
    return text
      .split('\n')
      .map((l) => this._cleanLine(l))
      .filter((l) => l.length > 1)
      .join('\n')
      .trim();
  }
}

export const ocrService = new OcrService();
