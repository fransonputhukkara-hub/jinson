import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// Supabase publishable keys are intended for browser use with RLS enabled.
 // Keep the legacy anon-key variable as a backwards-compatible fallback.
 const supabaseAnonKey =
   import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
   import.meta.env.VITE_SUPABASE_ANON_KEY ||
   '';

// Fail closed: the application never starts a mock/demo data service.
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_DEMO_MODE === 'false' &&
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  !supabaseUrl.includes('your-supabase-project')
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.error('[Supabase] Initialization failed. Live services are unavailable; no demo fallback will be selected:', err);
    client = null;
  }
}

export const supabase = client;
