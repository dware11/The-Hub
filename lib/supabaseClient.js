import { createBrowserClient } from '@supabase/ssr';

// DEMO MODE: if real Supabase credentials haven't been added to .env.local yet,
// the app falls back to sample data (see lib/sampleData.js) so it's fully
// demoable before Supabase/Microsoft sign-in are configured.
export const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (isDemoMode) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
