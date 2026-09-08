const PRIORITY_LABELS = {
  university_leadership: 'University Leadership',
  leadership: 'University Leadership',
  college_leadership: 'College Leadership',
  code_leadership: 'C.O.D.E. Leadership',
  code: 'C.O.D.E. Leadership',
  campus_organization: 'Campus/Organization',
  campus: 'Campus/Organization',
  standard: 'Standard',
};

export function normalizeAnnouncementPriority(value) {
  const key = String(value || 'standard').trim().toLowerCase();
  return PRIORITY_LABELS[key] || 'Standard';
}

export function announcementPriorityOptions() {
  return [
    ['leadership', 'University Leadership'],
    ['college_leadership', 'College Leadership'],
    ['code_leadership', 'C.O.D.E. Leadership'],
    ['campus_organization', 'Campus/Organization'],
    ['standard', 'Standard'],
  ];
}
