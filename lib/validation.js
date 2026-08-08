const CONTENT_TYPES = new Set(['opportunity', 'event', 'announcement']);
const OPPORTUNITY_TYPES = new Set([
  'Internship',
  'Co-op',
  'Research',
  'Scholarship',
  'Competition',
  'Other',
]);
const EVENT_TYPES = new Set([
  'Org meeting',
  'Workshop',
  'Career fair',
  'Competition',
  'College event',
  'Other',
]);

function text(value, field, { required = false, max = 5000 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && !normalized) throw new Error(`${field} is required.`);
  if (normalized.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
  return normalized;
}

function date(value, field, required = false) {
  const normalized = text(value, field, { required, max: 10 });
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error(`${field} must be a valid date.`);
  }
  return normalized;
}

function url(value, field, required = false) {
  const normalized = text(value, field, { required, max: 2048 });
  if (!normalized) return null;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${field} must be a valid web address.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${field} must use http or https.`);
  }
  return parsed.toString();
}

function email(value, field, required = false) {
  const normalized = text(value, field, { required, max: 320 }).toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${field} must be a valid email address.`);
  }
  return normalized;
}

function majors(value) {
  if (!Array.isArray(value) || value.length === 0) return ['All majors'];
  const normalized = [...new Set(value.map((item) => text(item, 'Major', { max: 100 })).filter(Boolean))];
  return normalized.length ? normalized.slice(0, 20) : ['All majors'];
}

export function validateSubmission(type, input) {
  if (!CONTENT_TYPES.has(type)) throw new Error('Unknown content type.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Submission payload is required.');
  }

  if (type === 'announcement') {
    return {
      source: text(input.source, 'Source', { required: true, max: 200 }),
      title: text(input.title, 'Title', { required: true, max: 300 }),
      body: text(input.body, 'Body', { required: true, max: 10000 }),
      pinned: false,
    };
  }

  const common = {
    title: text(input.title, 'Title', { required: true, max: 300 }),
    org: text(input.org, 'Organization or source', { required: true, max: 200 }),
    description: text(input.description, 'Description', { required: true, max: 10000 }),
    majors: majors(input.majors),
    location: text(input.location, 'Location', { max: 300 }) || null,
    contact_name: text(input.contact_name, 'Contact name', { required: true, max: 200 }),
    contact_email: email(input.contact_email, 'Contact email', true),
    flyer_url: input.flyer_url ? url(input.flyer_url, 'Flyer URL') : null,
  };

  if (type === 'opportunity') {
    const subtype = text(input.type, 'Opportunity type', { required: true, max: 100 });
    return {
      ...common,
      type: OPPORTUNITY_TYPES.has(subtype) ? subtype : 'Other',
      paid: Boolean(input.paid),
      deadline: date(input.deadline, 'Deadline', true),
      link: url(input.link, 'Application link', true),
    };
  }

  const subtype = text(input.type, 'Event type', { required: true, max: 100 });
  return {
    ...common,
    type: EVENT_TYPES.has(subtype) ? subtype : 'Other',
    date: date(input.date, 'Event date', true),
    time: text(input.time, 'Time', { max: 100 }) || null,
    registration_link: input.registration_link
      ? url(input.registration_link, 'Registration link')
      : null,
    presenter_name: text(input.presenter_name, 'Presenter name', { max: 200 }) || null,
    presenter_affiliation:
      text(input.presenter_affiliation, 'Presenter affiliation', { max: 300 }) || null,
  };
}
