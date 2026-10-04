const ALLOWED_AUTH_DESTINATIONS = new Set(['/submit', '/submit/opportunity', '/submit/event', '/panther-submit', '/panther-submit/submissions', '/workspace']);

export function safeAuthDestination(value) {
  return optionalSafeAuthDestination(value) || '/submit';
}

export function optionalSafeAuthDestination(value) {
  if (typeof value !== 'string') return '';
  let candidate = value.trim();
  if (!candidate) return '';

  // The supported Supabase email template carries the app-provided callback
  // URL in `next`. Unwrap that callback, but still return only an allowlisted
  // local path so an absolute/external URL can never become a redirect target.
  try {
    const parsed = new URL(candidate);
    if (parsed.pathname !== '/auth/confirm') return '';
    candidate = parsed.searchParams.get('next') || '';
  } catch {
    // Relative destinations are expected and are validated below.
  }

  const path = candidate.split('?')[0].split('#')[0];
  if (path === '/admin' || path.startsWith('/admin/')) return '/workspace';
  if (!ALLOWED_AUTH_DESTINATIONS.has(path)) return '';
  return candidate.startsWith(`${path}?`) || candidate === path ? candidate : '';
}

export { ALLOWED_AUTH_DESTINATIONS };
