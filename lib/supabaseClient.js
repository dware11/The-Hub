import { createBrowserClient } from '@supabase/ssr';

// Demo data is explicit. Live integration failures never substitute sample records.
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (isDemoMode) return null;
    throw new Error('Panther Hub is not configured. Supabase connection values are missing.');
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
