import { Router } from 'express';
import { emergencyController } from '../controllers/emergency.controller';
import { emergencyLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// POST /api/emergency/trigger   — Trigger SOS: notify contacts, log event
router.post('/trigger', emergencyLimiter, emergencyController.trigger);

// POST /api/emergency/resolve   — Mark active event as resolved
router.post('/resolve', emergencyController.resolve);

export default router;
