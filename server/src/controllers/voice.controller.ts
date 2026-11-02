import { Request, Response } from 'express';
import { voiceService } from '../services/voice.service';
import { z } from 'zod';

const TranscribeSchema = z.object({
  audio: z.string().min(1, 'Base64 audio is required'),
});

export const voiceController = {
  async transcribe(req: Request, res: Response): Promise<void> {
    const parse = TranscribeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid request: audio base64 is required' });
      return;
    }

    try {
      const result = await voiceService.transcribeAudio(parse.data.audio);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speech transcription failed';
      res.status(500).json({ error: msg });
    }
  },
};
