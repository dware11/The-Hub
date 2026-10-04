export const EVENT_FILTERS = [
  'All Events',
  'Key Dates & Milestones',
  'College of Engineering',
  'Engineering Student Organizations',
  'Campus & University',
];

export const REGISTERED_EVENT_ORGANIZATIONS = [
  { value: 'Council of Distinguished Engineers', label: 'Council of Distinguished Engineers', aliases: ['C.O.D.E.', 'CODE', 'Council of Distinguished Engineers', 'Council of Distinguished Engineers (C.O.D.E.)'] },
];

const SELECTABLE_FILTERS = EVENT_FILTERS.slice(1);
const normalizedOrganizationKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

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

function organizationRegistry(organizations = REGISTERED_EVENT_ORGANIZATIONS) {
  return organizations.map(item => typeof item === 'string'
    ? (REGISTERED_EVENT_ORGANIZATIONS.find(registered => normalizedOrganizationKey(registered.value) === normalizedOrganizationKey(item) || normalizedOrganizationKey(registered.label) === normalizedOrganizationKey(item)) || { value: item, label: item, aliases: [item] })
    : { ...item, aliases: item.aliases?.length ? item.aliases : [item.value, item.label].filter(Boolean) });
}

export function eventOrganization(event, organizations = REGISTERED_EVENT_ORGANIZATIONS) {
  const organization = String(event.org || '').trim().replace(/\s+/g, ' ');
  const registered = organizationRegistry(organizations).find((item) =>
    item.aliases.some((alias) => normalizedOrganizationKey(alias) === normalizedOrganizationKey(organization))
  );
  return registered?.value || '';
}

export function matchesEventCategories(event, selected) {
  return !selected.length || eventCategories(event).some((category) => selected.includes(category));
}

export function matchesEventOrganizations(event, selected, organizations = REGISTERED_EVENT_ORGANIZATIONS) {
  if (!selected.length) return true;
  const organization = normalizedOrganizationKey(eventOrganization(event, organizations));
  return selected.some((value) => normalizedOrganizationKey(value) === organization);
}

export function eventOrganizations(events, organizations = REGISTERED_EVENT_ORGANIZATIONS) {
  const registry = organizationRegistry(organizations);
  return [...new Map(registry.map(item => [normalizedOrganizationKey(item.value), { value: item.value, label: item.label }])).values()]
    .sort((a,b) => a.label.localeCompare(b.label));
}

export function priorityCalendarEvents(events) {
  if (events.length <= 35) return events;
  return events.filter(event => {
    const categories = eventCategories(event);
    return categories.some(category => category !== EVENT_FILTERS[3]);
  });
}
