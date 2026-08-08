// Sample data shown when the app is running in demo mode (no Supabase
// credentials configured yet). Once Supabase is connected, all of this
// is replaced by real database queries -- see lib/data.js.

export const MAJORS = [
  'All majors',
  'Computer Science',
  'Computer Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Mechanical Engineering',
  'Industrial Engineering',
];

// A tiny inline "flyer" placeholder so the "View original flyer" thumbnail
// has something to show in demo mode without any external image host.
const DEMO_FLYER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="260"><rect width="200" height="260" fill="%23241748"/><text x="20" y="60" fill="%23D4AF37" font-family="Georgia" font-size="18">RESUME</text><text x="20" y="86" fill="%23D4AF37" font-family="Georgia" font-size="18">WORKSHOP</text></svg>'
  );

// Simulated signed-in viewer shown when Supabase Auth isn't configured, so
// the submit form and admin review queue are walkable in demo mode too.
export const demoCurrentUser = {
  user: { email: 'demo@pvamu.edu' },
  role: {
    email: 'demo@pvamu.edu',
    role: 'admin',
    status: 'active',
    full_name: 'Demo Contributor',
    org: 'C.O.D.E.',
  },
};

export const samplePendingOpportunities = [
  {
    id: 'demo-pending-opp-1',
    title: 'Data Center Operations Intern — HP',
    org: 'CITE',
    type: 'Internship',
    paid: true,
    majors: ['Computer Science', 'Computer Engineering'],
    description: 'Hands-on internship supporting HP campus data center operations and network monitoring.',
    deadline: '2026-08-15',
    location: 'Houston, TX',
    link: 'https://example.com/apply',
    contact_name: 'Devon Reyes',
    contact_email: 'dreyes@pvamu.edu',
    flyer_url: DEMO_FLYER,
    status: 'pending',
    created_at: '2026-07-24',
  },
];

export const samplePendingEvents = [
  {
    id: 'demo-pending-evt-1',
    title: 'IEEE Chapter Meeting',
    type: 'Org meeting',
    majors: ['Electrical Engineering', 'Computer Engineering'],
    description: 'Monthly IEEE chapter meeting — officer elections this month.',
    date: '2026-07-28',
    time: '6:00 PM',
    location: 'Engineering Bldg Rm 110',
    registration_link: null,
    contact_name: 'IEEE Chapter',
    contact_email: 'ieee@pvamu.edu',
    org: 'IEEE PVAMU',
    status: 'pending',
    created_at: '2026-07-24',
  },
];

export const samplePendingAnnouncements = [
  {
    id: 'demo-pending-ann-1',
    source: 'Career Services',
    title: 'Fall Career Fair employer list posted',
    body: 'The full employer list for the fall career fair is now available on PawLink.',
    pinned: false,
    status: 'pending',
    created_at: '2026-07-25',
  },
];

export const sampleOpportunities = [
  {
    id: 'demo-opp-1',
    title: 'Software Engineering Co-op — Texas Instruments',
    org: 'Career Services',
    type: 'Co-op',
    paid: true,
    majors: ['Computer Science', 'Computer Engineering', 'Electrical Engineering'],
    description:
      "Six-month rotational co-op on TI's embedded systems team in Dallas, TX. Open to sophomores and juniors in CS, CPE, or EE.",
    deadline: '2026-08-14',
    location: 'Dallas, TX',
    link: 'https://example.com/apply',
    contact_name: 'Jasmine Miller',
    contact_email: 'jmiller@pvamu.edu',
    verified: true,
    flyer_url: DEMO_FLYER,
    created_at: '2026-07-10',
  },
  {
    id: 'demo-opp-2',
    title: 'SWE Regional Scholarship',
    org: 'Society of Women Engineers',
    type: 'Scholarship',
    paid: false,
    majors: ['All majors'],
    description: 'Regional scholarship open to all engineering majors in good academic standing.',
    deadline: '2026-08-02',
    location: 'N/A',
    link: 'https://example.com/apply',
    contact_name: 'SWE Chapter',
    contact_email: 'swe@pvamu.edu',
    verified: true,
    created_at: '2026-07-08',
  },
];

export const sampleEvents = [
  {
    id: 'demo-evt-1',
    title: 'Resume Workshop',
    type: 'Workshop',
    majors: ['All majors'],
    description:
      "A hands-on session with Career Services to build or refine your resume ahead of the fall career fair.",
    date: '2026-07-29',
    time: '4:00 PM – 5:15 PM',
    location: 'CITE Lab, Engineering Bldg 2nd Floor',
    registration_link: null,
    presenter_name: 'Devon Reyes',
    presenter_affiliation: 'PVAMU Alum · Texas Instruments',
    contact_name: 'Jasmine Miller',
    contact_email: 'jmiller@pvamu.edu',
    verified: true,
    flyer_url: DEMO_FLYER,
  },
  {
    id: 'demo-evt-2',
    title: 'Employer Info Session: ExxonMobil',
    type: 'Career fair',
    majors: ['All majors'],
    description: 'Meet ExxonMobil recruiters and learn about internship and full-time openings.',
    date: '2026-07-31',
    time: '5:30 PM',
    location: 'Engineering Bldg Rm 204',
    registration_link: null,
    presenter_name: null,
    presenter_affiliation: null,
    contact_name: 'Career Services',
    contact_email: 'careers@pvamu.edu',
    verified: true,
  },
];

export const sampleAnnouncements = [
  {
    id: 'demo-ann-1',
    source: 'College of Engineering',
    title: 'Fall move-in engineering orientation schedule is posted',
    body: 'All incoming engineering students should review the updated orientation week schedule.',
    pinned: true,
    created_at: '2026-07-23',
  },
  {
    id: 'demo-ann-2',
    source: 'C.O.D.E.',
    title: 'The Engineering Hub pilot is live',
    body: 'Org presidents can now request calendar access — reach out to your C.O.D.E. rep.',
    pinned: false,
    created_at: '2026-07-22',
  },
];
