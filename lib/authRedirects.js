const ALLOWED_AUTH_DESTINATIONS = new Set(['/submit', '/submit/opportunity', '/submit/event', '/panther-submit', '/admin/review', '/admin/committee', '/admin/content']);

export function safeAuthDestination(value) {
  if (typeof value !== 'string') return '/submit';
  const path = value.split('?')[0].split('#')[0];
  if (!ALLOWED_AUTH_DESTINATIONS.has(path)) return '/submit';
  return value.startsWith(`${path}?`) || value === path ? value : '/submit';
}

export { ALLOWED_AUTH_DESTINATIONS };
