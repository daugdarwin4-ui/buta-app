import { useState, useRef, useCallback } from 'react';
import type { CameraView } from 'expo-camera';
import { ocrService, OcrUnavailableError } from '../services/ocr/ocr.service';
import { ttsService } from '../services/tts/tts.service';
import { hapticsService } from '../services/haptics/haptics.service';
import { geminiService } from '../services/ai/gemini.service';
import type { OcrResult, OcrStatus } from '../types/ocr.types';

export function useTextReader() {
  const cameraRef = useRef<CameraView>(null);
  const [status, setStatus] = useState<OcrStatus>('ready');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  // Whether `result` holds text read from the photo, or an AI description of the scene
  const [resultKind, setResultKind] = useState<'text' | 'scene'>('text');

  const captureAndRead = useCallback(async () => {
    if (status === 'capturing' || status === 'processing') return;

    setStatus('capturing');
    setError(null);

    try {
      await hapticsService.buttonPress();

      // Take photo using CameraView ref (saved to a temp file; ML Kit reads it on-device)
      let imageUri = '';
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          base64: false,
          quality: 0.85,    // Higher quality = better OCR accuracy
          skipProcessing: false, // Keep EXIF rotation applied so text is upright
        });
        imageUri = photo?.uri ?? '';
      }

      if (!imageUri) {
        setStatus('error');
        setError('Camera did not capture an image. Please try again.');
        ttsService.speak('Camera capture failed. Please try again.', 'warning');
        return;
      }

      setStatus('processing');
      ttsService.speak('Reading text, please hold still.', 'info');

      // Recognise text on the device
      const ocrResult = await ocrService.extractTextFromImage(imageUri);
      setResultKind('text');
      setResult(ocrResult);

      if (ocrResult.text?.trim()) {
        setStatus('result');
        setHistory((prev) => [ocrResult.text, ...prev.slice(0, 9)]);
        const speechText = ocrService.formatForSpeech(ocrResult);
        ttsService.speakImmediate(speechText);
        await hapticsService.success();
      } else {
        // Genuinely no text found in the image
        setStatus('ready');
        ttsService.speak(
          'No text detected. Try moving closer, improving lighting, or holding the camera steady.',
          'info'
        );
        await hapticsService.triggerForRisk('warning');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to capture or read text.';
      setError(message);
      setStatus('error');
      ttsService.speak(
        err instanceof OcrUnavailableError ? err.message : 'Could not read text. Please try again.',
        'warning'
      );
      await hapticsService.triggerForRisk('warning');
    }
  }, [status]);

  /**
   * Take a photo and have the AI assistant describe it ("what is in front of me?").
   * Needs internet and the assistant's daily allowance; says so plainly when it cannot answer.
   */
  const captureAndDescribe = useCallback(
    async (question?: string) => {
      if (status === 'capturing' || status === 'processing') return;
      setStatus('capturing');
      setError(null);
      try {
        await hapticsService.buttonPress();
        if (!geminiService.isAvailable) {
          setStatus('ready');
          ttsService.speak(
            geminiService.status === 'cooling-down'
              ? 'The AI description has reached its free limit for now. Please try again later. Read Text still works.'
              : 'The AI description is not set up in this app. Read Text still works.',
            'warning'
          );
          return;
        }
        // Small photo: quicker to send on mobile data, and plenty for a description
        const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.3, skipProcessing: false });
        if (!photo?.base64) {
          setStatus('error');
          setError('Camera did not capture an image. Please try again.');
          ttsService.speak('Camera capture failed. Please try again.', 'warning');
          return;
        }
        setStatus('processing');
        ttsService.speak('Looking, please hold still.', 'info');

        const description = await geminiService.describeImage(photo.base64, question);
        if (!description) {
          setStatus('ready');
          ttsService.speak('I could not describe that right now. Check your internet connection and try again.', 'warning');
          await hapticsService.triggerForRisk('warning');
          return;
        }
        setResultKind('scene');
        setResult({ text: description, blocks: [] });
        setStatus('result');
        ttsService.speakImmediate(description);
        await hapticsService.success();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not describe the scene.');
        setStatus('error');
        ttsService.speak('Could not describe the scene. Please try again.', 'warning');
        await hapticsService.triggerForRisk('warning');
      }
    },
    [status]
  );

  const readResultAloud = useCallback(() => {
    if (!result?.text?.trim()) {
      ttsService.speak('No text detected yet. Point camera at a sign and tap Read Text.', 'info');
      return;
    }
    if (resultKind === 'scene') {
      ttsService.speakImmediate(result.text);
      hapticsService.buttonPress();
      return;
    }
    const speech = ocrService.formatForSpeech(result);
    ttsService.speakImmediate(speech);
    hapticsService.buttonPress();
  }, [result, resultKind]);

  const clearResult = useCallback(() => {
    setResult(null);
    setStatus('ready');
    setError(null);
  }, []);

  return {
    cameraRef,
    status,
    result,
    error,
    history,
    captureAndRead,
    captureAndDescribe,
    /** False when the app has no AI key: the Describe button is then hidden */
    canDescribe: geminiService.status !== 'not-configured',
    readResultAloud,
    clearResult,
  };
}
