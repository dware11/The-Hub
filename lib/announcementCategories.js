export const ANNOUNCEMENT_CATEGORIES = Object.freeze([
  'College',
  'C.O.D.E.',
  'Department',
  'Academic',
  'Event',
  'Student Organization',
  'General',
]);

export function announcementCategory(value) {
  return ANNOUNCEMENT_CATEGORIES.includes(value) ? value : 'General';
}
