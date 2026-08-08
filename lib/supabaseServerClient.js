import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isDemoMode } from './supabaseClient';

export { isDemoMode };

// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Reads the signed-in user's session from cookies, so all
// queries run as that user and are subject to their RLS policies -- there
// is no service-role/bypass client in this app. Admin actions work because
// the DB policies themselves check user_roles.role = 'admin' (see
// supabase/schema.sql), not because the client has elevated privileges.
export async function createServerSupabaseClient() {
  if (isDemoMode) return null;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies -- the
            // middleware below refreshes the session on every request, so
            // this is safe to ignore.
          }
        },
      },
    }
  );
}
