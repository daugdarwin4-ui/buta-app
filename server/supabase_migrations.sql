-- ============================================================
-- GuideAI — Supabase Database Migrations
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. profiles (extends auth.users) ──────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── 2. settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  user_id               UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tts_speed             FLOAT DEFAULT 1.0,
  tts_pitch             FLOAT DEFAULT 1.0,
  haptic_intensity      TEXT DEFAULT 'medium' CHECK (haptic_intensity IN ('low','medium','high')),
  detection_sensitivity TEXT DEFAULT 'medium' CHECK (detection_sensitivity IN ('low','medium','high')),
  high_contrast         BOOLEAN DEFAULT TRUE,
  font_size             TEXT DEFAULT 'large' CHECK (font_size IN ('normal','large','extra-large')),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings"
  ON public.settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. emergency_contacts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  priority    INT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contacts"
  ON public.emergency_contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. emergency_events ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  latitude     FLOAT,
  longitude    FLOAT,
  address      TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','resolved'))
);

ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emergency events"
  ON public.emergency_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emergency events"
  ON public.emergency_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emergency events"
  ON public.emergency_events FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 5. navigation_history (opt-in only) ────────────────────
CREATE TABLE IF NOT EXISTS public.navigation_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  destination TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  completed   BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.navigation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own navigation history"
  ON public.navigation_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. Auto-create profile on signup ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
