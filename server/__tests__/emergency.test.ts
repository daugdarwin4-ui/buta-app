/**
 * Express Integration Tests — Emergency & Navigation API endpoints
 * Tests: POST /api/emergency/trigger, POST /api/emergency/resolve, POST /api/navigation/route
 */
import request from 'supertest';
import express from 'express';
import axios from 'axios';
import emergencyRoutes from '../src/routes/emergency.routes';
import navigationRoutes from '../src/routes/navigation.routes';

// ── Mock Supabase and Twilio so tests run without real credentials ──
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'evt_test_123',
          device_id: 'device-test-1',
          latitude: 9.3168,
          longitude: 123.3059,
          contacts_notified: 0,
          status: 'active',
          triggered_at: new Date().toISOString(),
        },
        error: null,
      }),
    })),
  })),
}));

// Rate limiting has its own test below; the endpoint tests send more than 5 SOS requests
jest.mock('../src/middleware/rateLimit.middleware', () => ({
  emergencyLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('twilio', () =>
  jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'SM_test_123' }),
    },
  }))
);

jest.mock('../src/config/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    TWILIO_ACCOUNT_SID: 'ACtest',
    TWILIO_AUTH_TOKEN: 'token',
    TWILIO_PHONE_NUMBER: '+10000000000',
    GOOGLE_MAPS_API_KEY: 'test-maps-key',
    GOOGLE_CLOUD_VISION_API_KEY: '',
  },
}));

// ── Test app setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/emergency', emergencyRoutes);
app.use('/api/navigation', navigationRoutes);

// ─── Emergency Trigger endpoint ───────────────────────────────────────────────
describe('POST /api/emergency/trigger', () => {
  const validPayload = {
    deviceId: 'device-test-1',
    userFullName: 'Test User',
    latitude: 9.3168,
    longitude: 123.3059,
    address: 'Dumaguete City, Philippines',
    contacts: [{ name: 'Juan Dela Cruz', phone: '+63 917 000 0000' }],
  };

  it('returns 200 and texts each contact on valid request', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('event');
    expect(res.body.contactsNotified).toBe(1);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 when deviceId is missing', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send({ ...validPayload, deviceId: undefined });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when there are no contacts', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send({ ...validPayload, contacts: [] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when a contact phone number is invalid', async () => {
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send({ ...validPayload, contacts: [{ name: 'Bad', phone: 'call me' }] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when latitude is missing', async () => {
    const { latitude, ...noLat } = validPayload;
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send(noLat);

    expect(res.status).toBe(400);
  });

  it('accepts trigger without optional address field', async () => {
    const { address, ...noAddress } = validPayload;
    const res = await request(app)
      .post('/api/emergency/trigger')
      .send(noAddress);

    expect(res.status).toBe(200);
  });
});

// ─── Emergency Resolve endpoint ────────────────────────────────────────────────
describe('POST /api/emergency/resolve', () => {
  it('returns 200 on valid eventId', async () => {
    const res = await request(app)
      .post('/api/emergency/resolve')
      .send({ eventId: 'evt_test_123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });

  it('returns 400 when eventId is missing', async () => {
    const res = await request(app)
      .post('/api/emergency/resolve')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Navigation Route endpoint (GET /api/navigation/route) ───────────────────
// External map services are faked so the test is deterministic and needs no internet.
describe('GET /api/navigation/route', () => {
  const getSpy = jest.spyOn(axios, 'get');
  afterEach(() => getSpy.mockReset());
  afterAll(() => getSpy.mockRestore());

  const osrmRoute = {
    routes: [{
      distance: 300,
      duration: 240,
      geometry: { coordinates: [[123.3059, 9.3168], [123.3059, 9.3186], [123.3068, 9.3186]] },
      legs: [{
        steps: [
          { name: 'Perdices Street', distance: 200, duration: 160, maneuver: { type: 'depart', location: [123.3059, 9.3168] } },
          { name: 'Rizal Street', distance: 100, duration: 80, maneuver: { type: 'turn', modifier: 'right', location: [123.3059, 9.3186] } },
          { name: '', distance: 0, duration: 0, maneuver: { type: 'arrive', location: [123.3068, 9.3186] } },
        ],
      }],
    }],
  };

  it('returns 200 with a real walking route when the place is found', async () => {
    getSpy.mockImplementation(async (url: string) => {
      if (url.includes('photon.komoot.io')) {
        return { data: { features: [{ geometry: { coordinates: [123.3068, 9.3186] } }] } };
      }
      if (url.includes('routed-foot')) return { data: osrmRoute };
      throw new Error(`unexpected URL ${url}`);
    });

    const res = await request(app)
      .get('/api/navigation/route')
      .query({ originLat: '9.3168', originLng: '123.3059', destination: 'Silliman University' });

    expect(res.status).toBe(200);
    expect(res.body.totalDistanceMeters).toBe(300);
    expect(res.body.steps).toHaveLength(3);
    expect(res.body.steps[1].maneuver).toBe('turn-right');
  });

  it('returns an error instead of inventing a route when the place cannot be found', async () => {
    getSpy.mockImplementation(async (url: string) => {
      if (url.includes('photon.komoot.io')) return { data: { features: [] } };
      if (url.includes('nominatim')) return { data: [] };
      throw new Error(`unexpected URL ${url}`);
    });

    const res = await request(app)
      .get('/api/navigation/route')
      .query({ originLat: '9.3168', originLng: '123.3059', destination: 'Nowhere Place 123' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('steps');
  });
});

// ─── SOS rate limit ────────────────────────────────────────────────────────────
describe('emergencyLimiter', () => {
  it('blocks the 6th SOS request from the same client within a minute', async () => {
    const { emergencyLimiter } = jest.requireActual('../src/middleware/rateLimit.middleware');
    const limited = express();
    limited.post('/sos', emergencyLimiter, (_req, res) => { res.json({ ok: true }); });

    for (let i = 0; i < 5; i++) {
      expect((await request(limited).post('/sos')).status).toBe(200);
    }
    expect((await request(limited).post('/sos')).status).toBe(429);
  });
});
