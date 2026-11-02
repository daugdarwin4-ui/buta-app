# GuideAI — Backend Server (Node.js / Express / TypeScript)

Privileged backend service for GuideAI. Manages external API integrations (Google Maps Directions, Google Cloud Vision OCR, Twilio SMS), Supabase database access with elevated service-role privileges, and secure rate-limiting.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js 18+ (TypeScript with `ts-node-dev`)
- **Framework**: Express 5.0 with `helmet`, `cors`, and `express-rate-limit`
- **Validation**: Zod schema validation on all endpoints
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **External APIs**:
  - Twilio REST API (Emergency SMS dispatch)
  - Google Maps Directions API (Pedestrian routing proxy)
  - Google Cloud Vision API (Image text recognition)
- **Testing**: Jest + Supertest with mocked third-party clients

---

## 🚀 Setup & Execution

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Configure environment variables in `.env`:
   ```env
   PORT=3000
   NODE_ENV=development

   # Supabase (Service Role — NEVER expose to mobile client)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   SUPABASE_JWT_SECRET=your-jwt-secret

   # Twilio (SMS Alerting)
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=your-token
   TWILIO_PHONE_NUMBER=+1234567890

   # Google Cloud Vision & Maps
   GOOGLE_MAPS_API_KEY=AIza...
   GOOGLE_CLOUD_VISION_API_KEY=AIza...
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Run unit and integration tests:
   ```bash
   npm test
   ```

---

## 📡 API Endpoints

### 1. Emergency System
- `POST /api/emergency/trigger`
  - Body: `{ userId: string, userFullName: string, latitude: number, longitude: number, address?: string }`
  - Dispatches Twilio SMS containing Google Maps pin to user's registered contacts and logs event to `emergency_events`.
- `POST /api/emergency/resolve`
  - Body: `{ eventId: string }`
  - Marks an active emergency as resolved with timestamp.

### 2. Navigation
- `GET /api/navigation/route`
  - Query: `?originLat=9.3168&originLng=123.3059&destination=Silliman%20University`
  - Fetches walking directions via Google Maps or structured fallback routing.

### 3. OCR Text Reader
- `POST /api/ocr/extract`
  - Body: `{ image: "<base64 string>" }`
  - Performs Google Cloud Vision `TEXT_DETECTION` and `DOCUMENT_TEXT_DETECTION`.

### 4. Health Check
- `GET /health`
  - Returns `{ status: "ok", timestamp: "..." }`
