import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eventOrganizations, matchesEventOrganizations } from '../lib/eventCategories.js';
const read = p => fs.readFileSync(p, 'utf8');
assert.match(read('components/EventsCalendar.js'), /current===value\?null:value/);
assert.match(read('components/EventsCalendar.js'), /No events scheduled for this day/);
assert.match(read('components/EventsAllBrowser.js'), /Search events/);
assert.match(read('components/EventsAllBrowser.js'), /This Month/);
assert.match(read('components/EventsAllBrowser.js'), /Hosting organization/);
assert.match(read('components/EventsAllBrowser.js'), /organizations=\{organizations\}/);
assert.doesNotMatch(read('components/EventsAllBrowser.js'), /category === 'Engineering Student Organizations'/);
assert.match(read('components/EventsCalendarBrowser.js'), /searchParams\.get\('q'\)/);
assert.match(read('components/EventsCalendarBrowser.js'), /eventOrganizations\(events, approvedOrganizations\)/);
const organizationFixtures = [
  { org: 'Council of Distinguished Engineers (C.O.D.E.)' },
  { org: 'Prairie View A&M University' },
  { org: 'Roy G. Perry College of Engineering' },
];
const approvedOrganizations = ['Council of Distinguished Engineers'];
const organizationOptions = eventOrganizations(organizationFixtures, approvedOrganizations);
assert.deepEqual(organizationOptions, [{ value: 'Council of Distinguished Engineers', label: 'Council of Distinguished Engineers' }]);
assert.ok(matchesEventOrganizations({ org: 'Council of Distinguished Engineers (C.O.D.E.)' }, ['Council of Distinguished Engineers'], approvedOrganizations));
assert.ok(!matchesEventOrganizations({ org: 'Prairie View A&M University' }, ['Council of Distinguished Engineers'], approvedOrganizations));
assert.match(read('components/OpportunitiesBrowser.js'), /Search opportunities/);
assert.doesNotMatch(read('components/AnnouncementsBrowser.js'), /announcement-feature/);
assert.match(read('components/HomeSpotlightCarousel.js'), /contentType === 'announcement'/);
assert.match(read('app/page.js'), /contentType: 'announcement'/);
assert.match(read('components/AnnouncementsBrowser.js'), /Search announcements/);
assert.match(read('components/AnnouncementsBrowser.js'), /All categories/);
assert.match(read('components/AnnouncementsBrowser.js'), /Newest first/);
assert.match(read('components/AnnouncementsBrowser.js'), /PAGE_SIZE = 6/);
assert.match(read('app/announcements/[id]/page.js'), /Visit official source/);
assert.match(read('lib/data.js'), /expires_at/);
assert.match(read('app/admin/review/RecommendationPanel.js'), /Recommend featuring/);
assert.match(read('supabase/migrations/202609040003_announcement_recommendation_admin_controls.sql'), /manage_announcement_editorial/);
assert.match(read('app/admin/content/RecommendationAdmin.js'), /Add to Spotlight/);
assert.match(read('app/admin/review/ReviewQueue.js'), /Deadline Approaching/);
assert.doesNotMatch(read('app/admin/review/page.js'), /getEngagementMetrics/);
assert.match(read('app/admin/content/recommendActions.js'), /isAdmin/);
assert.match(read('components/OpportunitiesBrowser.js'), /some\(value => majors\.includes/);
assert.match(read('components/OpportunitiesBrowser.js'), /Clear majors/);
assert.match(read('lib/search.js'), /normalize\('NFKD'\)/);
assert.match(read('lib/dateFilters.js'), /monday/);
assert.match(read('components/MobileNav.js'), /aria-expanded/);
assert.match(read('app/admin/review/ReviewQueue.js'), /\/admin\/review\/\$\{type\}\/\$\{item\.id\}/);
assert.match(read('app/admin/review/[type]/[id]/ReviewSubmission.js'), /Approve & Publish/);
console.log('Editorial, recommendation, search, and calendar interaction checks passed.');
