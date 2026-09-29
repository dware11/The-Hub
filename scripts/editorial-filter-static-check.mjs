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
assert.match(read('components/EventsCalendarBrowser.js'), /eventOrganizations\(events\)/);
const organizationFixtures = [
  { org: 'SHPE' },
  { org: 'Society of Hispanic Professional Engineers' },
  { org: 'College of Engineering Student Services' },
  { org: 'New Robotics Club' },
];
const organizationOptions = eventOrganizations(organizationFixtures);
assert.equal(organizationOptions.filter(item => item.value === 'SHPE').length, 1);
assert.equal(organizationOptions.find(item => item.value === 'SHPE')?.label, 'Society of Hispanic Professional Engineers (SHPE)');
assert.ok(organizationOptions.some(item => item.label === 'New Robotics Club'));
assert.ok(matchesEventOrganizations({ org: 'Society of Hispanic Professional Engineers' }, ['SHPE']));
assert.ok(!matchesEventOrganizations({ org: 'NSBE' }, ['SHPE']));
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
assert.match(read('app/admin/review/ReviewQueue.js'), /<dialog open/);
assert.match(read('app/admin/review/ReviewQueue.js'), /Approve &amp; Publish/);
console.log('Editorial, recommendation, search, and calendar interaction checks passed.');
