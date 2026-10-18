import { createClient } from '@supabase/supabase-js';
import { planAwareFetch } from './planPrompt';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to a .env file (see .env.example).'
  );
}

// Stay signed in across visits and refresh sign-in quietly in the background.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  // Plan messages from the server open the one-tap upgrade pop-up.
  global: { fetch: planAwareFetch },
});
