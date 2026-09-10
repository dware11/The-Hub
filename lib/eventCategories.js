export const EVENT_FILTERS = [
  'All Events',
  'Key Dates & Milestones',
  'College of Engineering',
  'Engineering Student Organizations',
  'Campus & University',
];

export const REGISTERED_EVENT_ORGANIZATIONS = [
  { value: 'C.O.D.E.', label: 'Council of Distinguished Engineers (C.O.D.E.)', aliases: ['C.O.D.E.', 'CODE', 'Council of Distinguished Engineers'] },
];

const SELECTABLE_FILTERS = EVENT_FILTERS.slice(1);

export function eventCategories(event) {
  const explicit = [...(Array.isArray(event.categories) ? event.categories : []), event.category]
    .filter((category) => SELECTABLE_FILTERS.includes(category));
  if (explicit.length) return [...new Set(explicit)];

  const text = `${event.type || ''} ${event.org || ''} ${event.title || ''}`.toLowerCase();
  const inferred = [];
  if (/graduat|deadline|registration|commencement|milestone|class day|exam/.test(text)) inferred.push(EVENT_FILTERS[1]);
  if (/org meeting|student org|nsbe|swe|ieee|code/.test(text)) inferred.push(EVENT_FILTERS[3]);
  if (/college event|engineering|dean|department/.test(text)) inferred.push(EVENT_FILTERS[2]);
  return inferred.length ? [...new Set(inferred)] : [EVENT_FILTERS[4]];
}

export function eventCategory(event) {
  return eventCategories(event)[0];
}

export function eventCategoryClass(event) {
  const category = eventCategory(event);
  if (category === EVENT_FILTERS[1]) return 'event-category--milestones';
  if (category === EVENT_FILTERS[2]) return 'event-category--college';
  if (category === EVENT_FILTERS[3]) return 'event-category--organizations';
  return 'event-category--campus';
}

export function eventOrganization(event) {
  const organization = String(event.org || '').trim();
  const registered = REGISTERED_EVENT_ORGANIZATIONS.find((item) =>
    item.aliases.some((alias) => alias.toLowerCase() === organization.toLowerCase())
  );
  return registered?.value || organization;
}

export function matchesEventCategories(event, selected) {
  return !selected.length || eventCategories(event).some((category) => selected.includes(category));
}

export function matchesEventOrganizations(event, selected) {
  return !selected.length || selected.includes(eventOrganization(event));
}

export function eventOrganizations(events) {
  return [...new Map([...REGISTERED_EVENT_ORGANIZATIONS, ...events.map(event => ({ value: eventOrganization(event), label: eventOrganization(event) }))]
    .filter(item => item.value).map(item => [item.value, item])).values()].sort((a,b) => a.label.localeCompare(b.label));
}

export function priorityCalendarEvents(events) {
  if (events.length <= 35) return events;
  return events.filter(event => {
    const categories = eventCategories(event);
    return categories.some(category => category !== EVENT_FILTERS[3]);
  });
}
