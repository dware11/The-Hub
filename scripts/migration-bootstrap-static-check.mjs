import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDirectory = resolve(process.cwd(), 'supabase', 'migrations');
const migrationNames = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const expectedOrder = [
  '202607290000_panther_hub_baseline.sql',
  '202607300001_panther_hub_pilot_foundation.sql',
  '202607300002_panther_hub_audit_triggers.sql',
  '202608030001_panther_multi_source_intake.sql',
  '202608030002_panther_intake_storage_policy_fix.sql',
  '20260814_opportunity_discovery_fields.sql',
  '20260816_opportunity_eligibility.sql',
  '20260823_launch_rbac_alignment.sql',
  '202609020001_privacy_safe_engagement_analytics.sql',
  '202609020002_parser_feedback_and_review_evidence.sql',
  '202609020003_email_auth_access_and_content_admin.sql',
  '202609040001_people_access_role_management.sql',
  '202609040002_announcement_editorial_controls.sql',
  '202609040003_announcement_recommendation_admin_controls.sql',
  '202609050001_review_verification_evidence_gate.sql',
  '202609050002_review_correction_rpc.sql',
  '202609060001_announcement_publication_fields.sql',
  '202609060002_home_spotlight_controls.sql',
];

assert.deepEqual(migrationNames, expectedOrder, 'Migration filenames or ordering changed');

const readMigration = (name) => readFileSync(resolve(migrationsDirectory, name), 'utf8');
const baseline = readMigration(expectedOrder[0]);
const foundation = readMigration('202607300001_panther_hub_pilot_foundation.sql');
const auditTriggers = readMigration('202607300002_panther_hub_audit_triggers.sql');
const intake = readMigration('202608030001_panther_multi_source_intake.sql');
const intakeStorageFix = readMigration('202608030002_panther_intake_storage_policy_fix.sql');
const discovery = readMigration('20260814_opportunity_discovery_fields.sql');
const eligibility = readMigration('20260816_opportunity_eligibility.sql');
const rbac = readMigration('20260823_launch_rbac_alignment.sql');
const engagement = readMigration('202609020001_privacy_safe_engagement_analytics.sql');
const parserFeedback = readMigration('202609020002_parser_feedback_and_review_evidence.sql');
const launchAlignment = readMigration('202609020003_email_auth_access_and_content_admin.sql');
const peopleAccess = readMigration('202609040001_people_access_role_management.sql');
const editorial = readMigration('202609040002_announcement_editorial_controls.sql');
const recommendation = readMigration('202609040003_announcement_recommendation_admin_controls.sql');
const reviewEvidence = readMigration('202609050001_review_verification_evidence_gate.sql');
const reviewCorrection = readMigration('202609050002_review_correction_rpc.sql');
const announcementPublication = readMigration('202609060001_announcement_publication_fields.sql');
const homeSpotlight = readMigration('202609060002_home_spotlight_controls.sql');

for (const table of ['user_roles', 'opportunities', 'events', 'announcements']) {
  assert.match(baseline, new RegExp(`create table ${table}\\s*\\(`), `Baseline does not create ${table}`);
}

for (const helper of ['is_verified_contributor', 'is_admin', 'archive_expired_opportunities']) {
  assert.match(baseline, new RegExp(`create or replace function ${helper}\\(`), `Baseline does not create ${helper}`);
}

for (const bucket of ['flyers']) {
  assert.ok(baseline.includes(`values ('${bucket}', '${bucket}', true)`), `Baseline does not create ${bucket} bucket`);
}

assert.doesNotMatch(intake, /owner_id\s*=\s*auth\.uid\(\)/, 'Storage owner comparison must be type-safe');
assert.match(intake, /owner_id::text\s*=\s*auth\.uid\(\)::text/);
assert.match(intakeStorageFix, /owner_id::text\s*=\s*auth\.uid\(\)::text/);

for (const requiredFeature of [
  [foundation, 'create table audit_events'],
  [foundation, 'create table digest_runs'],
  [auditTriggers, 'create trigger opportunities_audit'],
  [auditTriggers, 'create trigger events_audit'],
  [auditTriggers, 'create trigger announcements_audit'],
  [intake, 'create table intake_sessions'],
  [intake, 'create table source_artifacts'],
  [intake, 'create table field_suggestions'],
  [intake, "values ('intake-sources', 'intake-sources', false)"],
  [discovery, 'opportunities_classifications_gin_idx'],
  [eligibility, 'add column if not exists eligibility text'],
]) {
  assert.ok(requiredFeature[0].includes(requiredFeature[1]), `Migration feature missing: ${requiredFeature[1]}`);
}

for (const finalControl of [
  "role in ('contributor','reviewer','admin')",
  'create or replace function claim_my_role()',
  'create or replace function review_content',
  'owners upload intake sources to bound path',
]) {
  assert.ok(rbac.includes(finalControl), `Final RBAC control missing: ${finalControl}`);
}

for (const privacyControl of [
  'create table public.engagement_daily',
  'create or replace function public.record_engagement',
  'create or replace function public.get_engagement_metrics',
  'create or replace function public.get_public_opportunity_connections',
  'revoke all on table public.engagement_daily from public, anon, authenticated',
  'reviewers read aggregate engagement',
]) {
  assert.ok(engagement.includes(privacyControl), `Engagement privacy control missing: ${privacyControl}`);
}
for (const prohibited of ['ip_address', 'user_agent', 'auth_user_id', 'email_address', 'referrer']) {
  assert.doesNotMatch(engagement, new RegExp(`\\n\\s*${prohibited}\\s+`, 'i'), `Prohibited analytics column: ${prohibited}`);
}
for (const feedbackControl of ['create table public.intake_parser_feedback', 'save_intake_parser_feedback', 'get_parser_feedback_metrics']) {
  assert.ok(parserFeedback.includes(feedbackControl), `Parser feedback control missing: ${feedbackControl}`);
}
for (const launchControl of ['create table public.contributor_access_requests', 'request_contributor_access', 'review_contributor_access_request', 'manage_published_content', 'get_access_request_export', "role in ('contributor','reviewer','admin','super_admin')"]) assert.ok(launchAlignment.includes(launchControl), `Launch alignment control missing: ${launchControl}`);
assert.ok(peopleAccess.includes("values('system','administrator',actor.id,'role_changed'"), 'Role changes must use the canonical audit actor type');
assert.doesNotMatch(peopleAccess, /'super_administrator'/, 'Role management uses an audit actor type rejected by the canonical constraint');
for (const evidenceControl of ['create table if not exists public.review_verification_evidence', 'record_review_evidence', 'Complete all required verification items before publishing', 'Rejection reason required']) assert.ok(reviewEvidence.includes(evidenceControl), `Review evidence control missing: ${evidenceControl}`);
for (const correctionControl of ['request_review_correction', 'Correction reason required', "decision='needs_correction'", 'review_correction_requested']) assert.ok(reviewCorrection.includes(correctionControl), `Correction RPC control missing: ${correctionControl}`);
for (const publicationControl of ['add column if not exists category text', 'add column if not exists source_url text', 'add column if not exists published_at timestamptz', 'set_announcement_published_at', 'announcements_category_check']) assert.ok(announcementPublication.includes(publicationControl), `Announcement publication control missing: ${publicationControl}`);
for (const spotlightControl of ['manage_home_spotlight', 'Only published content can be featured', 'home_spotlight_added', 'spotlight_rank']) assert.ok(homeSpotlight.includes(spotlightControl), `Home spotlight control missing: ${spotlightControl}`);

console.log(`Migration bootstrap static checks passed: ${migrationNames.length} ordered migrations with a complete baseline.`);
