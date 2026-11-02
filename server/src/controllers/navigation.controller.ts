import { Request, Response } from 'express';
import { mapsService } from '../services/maps.service';

export const navigationController = {
  async getRoute(req: Request, res: Response): Promise<void> {
    try {
      const { originLat, originLng, destination } = req.query;

      const lat = originLat ? parseFloat(originLat as string) : 9.3071;
      const lng = originLng ? parseFloat(originLng as string) : 123.3011;
      const dest = (destination as string) || 'Public Market, Dumaguete City';

      const routePlan = await mapsService.getDirections({ latitude: lat, longitude: lng }, dest);
      res.json(routePlan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching route directions';
      res.status(500).json({ error: msg });
    }
  },
};
