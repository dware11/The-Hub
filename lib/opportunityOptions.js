export const OPPORTUNITY_TYPES = Object.freeze([
  'Internship',
  'Co-op',
  'Full-Time',
  'Research',
  'Scholarship',
  'Competition',
  'Other',
]);

export const OPPORTUNITY_CLASSIFICATIONS = Object.freeze([
  'Senior',
  'Graduating Senior',
  'Graduate Student',
]);

export const FULL_TIME_DEFAULT_CLASSIFICATIONS = OPPORTUNITY_CLASSIFICATIONS;

export const OPPORTUNITY_COMPENSATION_TYPES = Object.freeze(['Paid', 'Unpaid']);

export function normalizeOpportunityClassifications(values = []) {
  const source = Array.isArray(values) ? values : [];
  if (source.includes('All classifications')) return [...OPPORTUNITY_CLASSIFICATIONS];
  return [...new Set(source
    .map((value) => value === 'Graduate' || value === 'Grad Student' ? 'Graduate Student' : value)
    .filter((value) => OPPORTUNITY_CLASSIFICATIONS.includes(value)))];
}

export function opportunityCompensationLabel(value, paid = false) {
  if (paid || value === 'Paid' || value === 'Funded') return 'Paid / Funded';
  if (value === 'Unpaid') return 'Unpaid';
  return 'Not specified';
}

export const DEADLINE_TYPES = Object.freeze([
  ['specific_date', 'Specific application deadline'],
  ['rolling', 'Deadline not provided / Apply ASAP'],
  ['no_deadline', 'No Deadline'],
  ['not_provided', 'Deadline Not Provided'],
]);

export const SUBMISSION_DEADLINE_TYPES = Object.freeze(DEADLINE_TYPES.slice(0, 2));
export const SUBMISSION_DEADLINE_TYPE_VALUES = new Set(SUBMISSION_DEADLINE_TYPES.map(([value]) => value));

export const DEADLINE_TYPE_VALUES = new Set(DEADLINE_TYPES.map(([value]) => value));

export function deadlineLabel(deadlineType, deadline, postedDate = null) {
  if (deadlineType === 'rolling') {
    if (!postedDate) return 'Deadline not provided / Apply ASAP';
    const posted = new Date(`${postedDate}T12:00:00Z`);
    if (Number.isNaN(posted.getTime())) return 'Deadline not provided / Apply ASAP';
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const postedUtc = Date.UTC(posted.getUTCFullYear(), posted.getUTCMonth(), posted.getUTCDate());
    const days = Math.max(0, Math.floor((todayUtc - postedUtc) / 86400000));
    return `Apply ASAP · Posted ${days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`}`;
  }
  if (deadlineType === 'no_deadline') return 'No Deadline';
  if (deadlineType === 'not_provided') return 'Deadline Not Provided';
  return deadline || 'Specific date required';
}
