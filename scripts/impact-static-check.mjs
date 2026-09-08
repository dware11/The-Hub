import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const metrics = read('lib/reviewMetrics.js');
const metricUi = read('app/admin/review/ReviewMetrics.js');
const tracker = read('lib/engagement.js');
const api = read('app/api/engagement/route.js');
const home = read('app/page.js');
const event = read('app/events/[id]/page.js');
const opportunity = read('app/opportunities/[id]/page.js');
const announcements = read('app/announcements/page.js');

assert.match(metrics, /THREE_DAYS_MS = 3 \* 24/);
assert.match(metrics, /waitingMoreThanThreeDays/);
assert.doesNotMatch(metrics + metricUi, /FiveDays|5 days|five full days/i);
assert.match(metricUi, /Pending more than 3 days/);

assert.match(tracker, /credentials: 'omit'/);
assert.match(tracker, /referrerPolicy: 'no-referrer'/);
assert.match(tracker, /\.catch\(\(\) => \{\}\)/);
assert.match(api, /status: 202/);
assert.match(api, /record_engagement/);

assert.match(home, /Excellence finds every/);
assert.match(home, /HomeSpotlightCarousel/);
assert.doesNotMatch(home, /outbound application-link clicks/);
assert.match(opportunity, /action="detail_view"/);
assert.match(opportunity, /action="application_click"/);
assert.match(event, /action="detail_view"/);
assert.match(event, /action="registration_click"/);
assert.match(announcements, /action="list_view"/);

for (const prohibited of ['ip_address', 'user_agent', 'auth_user_id', 'email_address']) {
  assert.doesNotMatch(tracker + api, new RegExp(prohibited, 'i'));
}

console.log('Impact checks passed: 3-day queue threshold, privacy-safe telemetry, route actions, and the current homepage spotlight.');
