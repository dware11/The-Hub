export const REVIEW_TYPES = ['all', 'events', 'opportunities', 'announcements'];

export function reviewQueueCounts(queue) {
  const counts = {
    events: queue.events?.length || 0,
    opportunities: queue.opportunities?.length || 0,
    announcements: queue.announcements?.length || 0,
  };
  return { ...counts, all: counts.events + counts.opportunities + counts.announcements };
}

export function activeReviewType(requested) {
  return REVIEW_TYPES.includes(requested) ? requested : 'all';
}

export function boundedReviewItems(items, visible) {
  return items.slice(0, Math.max(0, visible));
}
