import { Request, Response } from 'express';
import { ocrService } from '../services/ocr.service';
import { z } from 'zod';

const ExtractSchema = z.object({
  image: z.string().min(100, 'Base64 image is required'),
});

export const ocrController = {
  async extractText(req: Request, res: Response): Promise<void> {
    const parse = ExtractSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid request: image field is required (base64 string)' });
      return;
    }

    try {
      const result = await ocrService.extractText(parse.data.image);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OCR extraction failed';
      res.status(500).json({ error: msg });
    }
  },
};
