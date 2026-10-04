export const ORGANIZATION_TYPES = Object.freeze([
  'Student Organization',
  'Department or College',
  'University Office',
  'Company or Employer',
  'Professional Organization',
  'Other',
]);

export const ORGANIZATION_TAXONOMY_TYPES = Object.freeze([
  'Student Organization',
  'Professional Organization',
]);

export function organizationTaxonomyScope(type) {
  if (ORGANIZATION_TAXONOMY_TYPES.includes(type)) return 'organization';
  if (['Department or College', 'University Office'].includes(type)) return 'affiliation';
  if (type === 'Company or Employer') return 'employer';
  return 'other';
}
