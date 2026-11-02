import { Router } from 'express';
import { voiceController } from '../controllers/voice.controller';

const router = Router();

router.post('/transcribe', voiceController.transcribe);

export { router as voiceRoutes };
