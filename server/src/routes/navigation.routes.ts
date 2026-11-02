import { Router } from 'express';
import { navigationController } from '../controllers/navigation.controller';

const router = Router();

// GET /api/navigation/route?originLat=...&originLng=...&destination=...
router.get('/route', navigationController.getRoute);

export default router;
