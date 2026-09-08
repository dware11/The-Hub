export const ENGAGEMENT_ACTIONS = Object.freeze({
  opportunity: new Set(['detail_view', 'application_click', 'source_click', 'calendar_outlook', 'calendar_google']),
  event: new Set(['detail_view', 'registration_click', 'source_click', 'calendar_outlook', 'calendar_google']),
  announcement: new Set(['list_view']),
});

export function validEngagement({ contentType, contentId, action } = {}) {
  return Boolean(
    ENGAGEMENT_ACTIONS[contentType]?.has(action)
      && typeof contentId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(contentId.trim())
  );
}

export function trackEngagement(payload) {
  if (typeof window === 'undefined' || !validEngagement(payload)) return;
  try {
    void fetch('/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Engagement is intentionally best-effort and never blocks navigation.
  }
}

export function rowsToEngagementCounts(rows = []) {
  const counts = {};
  for (const row of rows) {
    if (!counts[row.content_type]) counts[row.content_type] = {};
    counts[row.content_type][row.action] = Number(row.event_count || 0);
  }
  return counts;
}
