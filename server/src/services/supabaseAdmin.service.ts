import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Supabase Admin client — uses service-role key.
 * ONLY used server-side. Never exposed to mobile.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
