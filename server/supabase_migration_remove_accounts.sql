-- ============================================================================
-- GuideAI — remove user accounts (2026-09-29)
-- Run once in the Supabase SQL editor, after supabase_migrations.sql.
--
-- The app no longer has login/sign-up. Name, settings and emergency contacts
-- live on the phone; contacts are sent with each SOS request. The server only
-- logs SOS events, keyed by a random per-install device id.
-- ============================================================================

-- emergency_events: no longer tied to auth users
ALTER TABLE public.emergency_events DROP CONSTRAINT IF EXISTS emergency_events_user_id_fkey;
ALTER TABLE public.emergency_events ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS contacts_notified INT DEFAULT 0;

-- Nobody signs in anymore, so the per-user policy can never match.
-- RLS stays ENABLED with no policies: only the server (service-role key) can read/write.
DROP POLICY IF EXISTS "Users can view own emergency events" ON public.emergency_events;

-- profiles, settings and emergency_contacts are no longer used by the app.
-- They are left in place so no data is lost. Drop them once you are sure:
--   DROP TABLE IF EXISTS public.emergency_contacts;
--   DROP TABLE IF EXISTS public.settings;
--   DROP TABLE IF EXISTS public.profiles;
