import { Request, Response } from 'express';
import { z } from 'zod';
import { emergencyService } from '../services/emergency.service';

// There are no user accounts: the phone sends the contacts to alert along with the SOS.
const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number'),
});

const TriggerSchema = z.object({
  deviceId: z.string().min(1).max(64),
  userFullName: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(300).optional(),
  contacts: z.array(ContactSchema).min(1, 'At least one contact is required').max(10),
});

const ResolveSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
});

export const emergencyController = {
  async trigger(req: Request, res: Response): Promise<void> {
    const parse = TriggerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid request body', details: parse.error.flatten().fieldErrors });
      return;
    }

    try {
      const result = await emergencyService.triggerSOS(parse.data);
      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger SOS';
      res.status(500).json({ error: msg });
    }
  },

  async resolve(req: Request, res: Response): Promise<void> {
    const parse = ResolveSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    try {
      const result = await emergencyService.resolveEvent(parse.data.eventId);
      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve event';
      res.status(500).json({ error: msg });
    }
  },
};
