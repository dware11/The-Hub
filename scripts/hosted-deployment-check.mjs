import assert from 'node:assert/strict';

const baseUrl = process.env.HOSTED_BASE_URL || 'https://hub.codepv.org';
const fetchPage = async path => {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assert.ok([200, 307, 308].includes(response.status), `${path} returned ${response.status}`);
  return { response, body: await response.text() };
};

const home = await fetchPage('/');
assert.match(home.body, /data-code-hub-feature-set="v1-calendar-ranges-v2;events-org-filter-v1;role-aware-nav-v2;public-badges-v2"/);

const events = await fetchPage('/events');
assert.match(events.body, /events-week-spans/);
assert.doesNotMatch(events.body, /events-range-strip/);

const allEvents = await fetchPage('/events/all');
assert.match(allEvents.body, /Hosting organization/);

const admin = await fetchPage('/admin');
assert.match(admin.body, /Sign in required/);
assert.match(admin.body, /href="\/auth\/signin\?next=%2Fadmin"/);

const confirmation = await fetchPage('/auth/confirm');
assert.doesNotMatch(confirmation.body, /\/auth\/signin\?next=(?:"|&quot;)/);

const eventDetail = await fetchPage('/events/704f675c-7e90-4be8-9477-094a1f63365f');
const opportunities = await fetchPage('/opportunities');
const opportunityPath = opportunities.body.match(/href="(\/opportunities\/[^"?#]+)["?]/)?.[1];
const publicPages = [home.body, events.body, allEvents.body, eventDetail.body, opportunities.body];
if (opportunityPath) publicPages.push((await fetchPage(opportunityPath)).body);
for (const body of publicPages) assert.doesNotMatch(body, /✓\s*Verified|verified-badge/i);

console.log(`Hosted deployment markers passed for ${baseUrl}.`);
