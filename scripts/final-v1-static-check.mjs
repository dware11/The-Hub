import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const admin = read('app/admin/page.js');
const layout = read('app/layout.js');
const nav = read('components/Nav.js');
const desktop = read('components/DesktopNavMenus.js');
const mobile = read('components/MobileNav.js');
const calendar = read('components/EventsCalendar.js');
const allEvents = read('components/EventsAllBrowser.js');
const eventDetail = read('app/events/[id]/page.js');
const opportunityDetail = read('app/opportunities/[id]/page.js');
const opportunityCards = read('components/OpportunitiesBrowser.js');

assert.match(admin, /href="\/auth\/signin\?next=%2Fadmin"/);
assert.match(admin, />Sign in<\/Link>/);
assert.match(layout, /data-code-hub-feature-set=\{CODE_HUB_FEATURE_SET\}/);
assert.match(layout, /v1-calendar-ranges-v2;events-org-filter-v1;role-aware-nav-v2;public-badges-v2/);
assert.match(nav, /const contributor = canSubmit\(viewer\) && !reviewer/);
assert.doesNotMatch(nav, /nav-workspace-link/);
assert.match(desktop, /\{contributor && <Link href="\/panther-submit"/);
assert.match(desktop, /label="Workspace" href="\/workspace"/);
assert.match(desktop, /\{superAdmin &&/);
for (const route of ['/admin/issues', '/admin/history', '/admin/system-insights']) {
  assert.match(desktop, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(mobile, new RegExp(route.replaceAll('/', '\\/')));
}
assert.match(calendar, /calendarWeekSegments/);
assert.match(calendar, /events-week-spans/);
assert.doesNotMatch(calendar, /events-range-strip/);
assert.match(allEvents, /eventOrganizations\(events\)/);
assert.match(allEvents, /matchesEventOrganizations\(event, organizationsSelected\)/);
assert.match(allEvents, />Hosting organization</);
for (const source of [eventDetail, opportunityDetail, opportunityCards]) assert.doesNotMatch(source, /✓ Verified|verified-badge/);

console.log('Final V1 static checks passed.');
