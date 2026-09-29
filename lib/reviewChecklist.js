export const REVIEW_CHECKS = Object.freeze([
  ['source', 'Official source opened and works'],
  ['title', 'Title/headline matches the official source'],
  ['date', 'Date/deadline matches the official source'],
  ['host', 'Host/organization matches the official source'],
  ['contact', 'Submitted contact is reasonable'],
  ['safe', 'Content is safe and appropriate for the Hub'],
]);

export const emptyReviewChecklist = () => Object.fromEntries(REVIEW_CHECKS.map(([key]) => [key, false]));

export const isReviewChecklistComplete = (checklist = {}) => REVIEW_CHECKS.every(([key]) => Boolean(checklist[key]));

export function reviewEvidence(checklist = {}, reviewerNotes = '') {
  return {
    official_source_opened: Boolean(checklist.source),
    primary_link_checked: Boolean(checklist.source),
    essential_facts_verified: Boolean(checklist.title && checklist.date),
    contact_organization_verified: Boolean(checklist.host && checklist.contact),
    safe_content_confirmed: Boolean(checklist.safe),
    reviewer_notes: reviewerNotes,
  };
}
