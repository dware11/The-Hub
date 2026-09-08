import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { assertProductionConfiguration } from './lib/config';

// Refreshes the Supabase auth session on every matched request so server
// components always see an up-to-date cookie. No-ops entirely in demo mode.
export async function proxy(request) {
  // Keep local development flexible, but fail closed on the first request in
  // a production deployment if demo mode or the live Supabase configuration
  // is unsafe. Keeping this inside the request boundary avoids executing
  // runtime validation while Next.js is compiling the production bundle.
  assertProductionConfiguration();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
