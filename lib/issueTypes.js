export const CONTENT_ISSUES = [
  'Broken link',
  'Wrong date/deadline',
  'Wrong information',
  'Duplicate',
  'Event canceled/changed',
  'Other',
];

export const OPPORTUNITY_ISSUES = [
  'Application link does not work',
  'Opportunity expired / no longer available',
  'Information is incorrect',
  'Other',
];

export const EVENT_ISSUES = [
  'Registration/details link does not work',
  'Event canceled / no longer happening',
  'Information is incorrect',
  'Other',
];

export function issuesForContentType(contentType) {
  if (contentType === 'opportunity') return OPPORTUNITY_ISSUES;
  if (contentType === 'event') return EVENT_ISSUES;
  return CONTENT_ISSUES;
}

export const SITE_ISSUES = [
  'Organization addition request',
  'Sign-in issue',
  'Submission issue',
  'Calendar/display issue',
  'Page error',
  'Accessibility issue',
  'Other',
];
