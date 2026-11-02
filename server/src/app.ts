import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health.routes';

const app = express();

// ─── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? ['https://your-production-domain.com'] // update for production
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Request parsing ───────────────────────────────────────────
app.use(express.json({ limit: '12mb' })); // Allow base64 image uploads for OCR
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ─────────────────────────────────────────────
app.use(generalLimiter);

import navigationRoutes from './routes/navigation.routes';
import ocrRoutes from './routes/ocr.routes';
import emergencyRoutes from './routes/emergency.routes';
import { voiceRoutes } from './routes/voice.routes';

// ─── Routes ────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/voice', voiceRoutes);

// ─── Error handling (must be last) ────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);
app.listen(PORT, () => {
  console.log(`🚀 GuideAI API running on port ${PORT} [${env.NODE_ENV}]`);
});

export default app;
