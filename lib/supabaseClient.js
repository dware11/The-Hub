import { createBrowserClient } from '@supabase/ssr';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function createClient() {
  if (isDemoMode) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Panther Hub is not configured. Supabase connection values are missing.');
  }
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
