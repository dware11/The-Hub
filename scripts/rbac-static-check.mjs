import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const auth = read('lib/auth.js');
const callback = read('app/auth/callback/route.js');
const redirects = read('lib/authRedirects.js');
const config = read('lib/config.js');
const migration = read('supabase/migrations/20260823_launch_rbac_alignment.sql');
const adminData = read('lib/adminData.js');
const signIn = read('components/SignInButton.js');
const proxy = read('proxy.js');
const digestRoute = read('app/api/cron/weekly-digest/route.js');
const bootstrap = read('supabase/bootstrap/first_super_admin.sql');

assert.match(auth, /export function canSubmit[\s\S]*\['super_admin', 'admin', 'reviewer', 'contributor'\]/);
assert.match(auth, /export function canReview[\s\S]*\['super_admin', 'admin', 'reviewer'\]/);
assert.match(auth, /export function isAdmin[\s\S]*\['super_admin', 'admin'\]/);
assert.doesNotMatch(auth, /platform_admin|code_officer/);

for (const path of ['/submit', '/panther-submit', '/admin/review']) assert.ok(redirects.includes(`'${path}'`));
assert.match(redirects, /return '\/submit'/);
assert.match(callback, /safeAuthDestination/);
assert.match(callback, /role_claim_failed/);

assert.match(config, /NEXT_PUBLIC_DEMO_MODE and DEMO_MODE are prohibited in production/);
assert.match(config, /!publicDemo && !serverDemo && missing\.length === 0/);
assert.match(proxy, /assertProductionConfiguration\(\)/);

assert.match(digestRoute, /if \(!cronSecret\)/);
assert.match(digestRoute, /status: 503/);
assert.match(digestRoute, /auth !== `Bearer \$\{cronSecret\}`/);

assert.match(signIn, /auth\/signin/);
assert.doesNotMatch(signIn, /provider: 'azure'|offline_access|graph|calendar/i);
assert.match(read('components/EmailSignInForm.js'), /signInWithOtp/);
assert.match(read('app/auth/confirm/route.js'), /verifyOtp/);

for (const required of [
  'auth_user_id uuid',
  "role in ('contributor','reviewer','admin')",
  'create or replace function claim_my_role()',
  'create or replace function is_reviewer()',
  'create or replace function review_content',
  'Only pending content can be reviewed',
  'revoke update on opportunities, events, announcements from authenticated',
  'drop policy if exists "authenticated actors append audit events"',
  'owners upload intake sources to bound path',
  "state <> 'submitted'",
  'set search_path = public, pg_temp',
  "when role = 'admin' then 'admin' else 'contributor'",
  'RBAC postcondition failed',
]) assert.ok(migration.includes(required), `Missing migration control: ${required}`);

const launch = read('supabase/migrations/202609020003_email_auth_access_and_content_admin.sql');
for (const required of ['super_admin', 'contributor_access_requests', 'review_contributor_access_request', 'manage_published_content', 'get_access_request_export']) assert.ok(launch.includes(required), `Missing launch control: ${required}`);
const people = read('supabase/migrations/202609040001_people_access_role_management.sql');
for (const required of ['manage_user_role', 'get_people_access_roster', 'At least one active super administrator is required', 'Administrators may manage contributors and reviewers only', 'role_changed']) assert.ok(people.includes(required), `Missing people access control: ${required}`);
const editorial = read('supabase/migrations/202609040002_announcement_editorial_controls.sql');
for (const required of ['priority', 'is_featured', 'featured_until', 'expires_at', 'feature_recommendations', 'recommend_announcement_feature']) assert.ok(editorial.includes(required), `Missing editorial control: ${required}`);

assert.match(migration, /revoke all on function claim_my_role\(\) from public/);
assert.match(migration, /grant execute on function claim_my_role\(\) to authenticated/);
assert.match(migration, /email_confirmed_at is not null/);
assert.match(migration, /auth_user_id is null[\s\S]*for update skip locked/);
assert.match(adminData, /\.rpc\('review_content'/);
assert.doesNotMatch(adminData, /\.from\(table\)\.update/);

for (const required of [
  ':\'bootstrap_email\'',
  "role = 'super_admin' and status = 'active'",
  'email_confirmed_at is not null',
  "'initial_super_admin_bootstrapped'",
]) assert.ok(bootstrap.includes(required), `Missing first-super-admin bootstrap control: ${required}`);
assert.doesNotMatch(bootstrap, /@pvamu\.edu/i);

console.log('RBAC static checks passed: role matrix, email-auth path, callback allowlist, production guard, migration policies/RPCs, and review path.');
