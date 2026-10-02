export const REVIEW_CHECKS = Object.freeze([
  ['source', 'Open the source or application link', 'Confirm the link works and leads to the opportunity, event, or announcement being reviewed.'],
  ['title', 'Confirm the title and organization', 'Make sure the title and hosting organization match the original source.'],
  ['date', 'Confirm the important dates and links', 'Check the event date or application deadline and verify any registration or application link.'],
  ['description', 'Read the description for accuracy', 'Confirm the summary reflects the source and does not add misleading claims.'],
  ['contact', 'Confirm the public contact', 'Verify the contact information, or confirm that no public contact is available.'],
  ['safe', 'Confirm it is appropriate for students', 'Reject or request correction for nudity, sexual content, graphic violence, harassment, hate, scams, or other unsafe material.'],
]);

export const emptyReviewChecklist = () => Object.fromEntries(REVIEW_CHECKS.map(([key]) => [key, false]));

export const isReviewChecklistComplete = (checklist = {}) => REVIEW_CHECKS.every(([key]) => Boolean(checklist[key]));

export function reviewEvidence(checklist = {}, reviewerNotes = '') {
  return {
    official_source_opened: Boolean(checklist.source),
    primary_link_checked: Boolean(checklist.source),
    essential_facts_verified: Boolean(checklist.title && checklist.date && checklist.description),
    contact_organization_verified: Boolean(checklist.title && checklist.contact),
    safe_content_confirmed: Boolean(checklist.safe),
    reviewer_notes: reviewerNotes,
  };
}
