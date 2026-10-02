export const HUB_BUSINESS_TIME_ZONE = 'America/Chicago';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getHubBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HUB_BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addCalendarDays(dateValue, days) {
  if (!DATE_ONLY_PATTERN.test(dateValue)) throw new Error(`Invalid date-only value: ${dateValue}`);
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isActiveOpportunity(item, today = getHubBusinessDate()) {
  if (item?.deadline_type && item.deadline_type !== 'specific_date') return true;
  return Boolean(item?.deadline && item.deadline >= today);
}

export function isOpportunityInDigest(item, today = getHubBusinessDate(), windowDays = 21) {
  if (!item?.deadline) return false;
  return item.deadline >= today && item.deadline <= addCalendarDays(today, windowDays);
}

export function isClosingThisWeek(dateValue, today = getHubBusinessDate()) {
  if (!DATE_ONLY_PATTERN.test(dateValue) || !DATE_ONLY_PATTERN.test(today)) return false;
  const [year, month, day] = today.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monday = addCalendarDays(today, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = addCalendarDays(monday, 6);
  return dateValue >= monday && dateValue <= sunday;
}
