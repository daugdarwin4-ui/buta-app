import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';

const router = Router();

// POST /api/ocr/extract   body: { image: string (base64) }
router.post('/extract', ocrController.extractText);

export default router;
