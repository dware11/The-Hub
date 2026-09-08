export const REVIEW_WINDOWS = Object.freeze({ week: 7, month: 30, all: null });
export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function cutoffIso(days, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function countSubmissionRecords(records, days, now = new Date()) {
  if (days == null) return records.length;
  const cutoff = new Date(cutoffIso(days, now)).getTime();
  return records.filter((item) => {
    const submitted = new Date(item.created_at || item.submitted_at || '').getTime();
    return Number.isFinite(submitted) && submitted >= cutoff && submitted <= now.getTime();
  }).length;
}

export function waitingMoreThanThreeDays(queue, now = Date.now()) {
  return Object.values(queue).flat().filter((item) => {
    const submitted = new Date(item.created_at || item.submitted_at || '').getTime();
    return item.status === 'pending' && Number.isFinite(submitted) && submitted < now - THREE_DAYS_MS;
  }).length;
}

export function engagementActionCount(metrics, contentType, actions) {
  if (!metrics || metrics.available === false) return null;
  const actionList = Array.isArray(actions) ? actions : [actions];
  return actionList.reduce((total, action) => total + Number(metrics.counts?.[contentType]?.[action] || 0), 0);
}
