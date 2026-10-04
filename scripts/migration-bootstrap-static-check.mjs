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
  '20260908180317_revoke_public_execute_rls_auto_enable.sql',
  '20260908184025_prevent_reviewer_self_review.sql',
  '20260909001132_normalize_v1_data_api_privileges.sql',
  '20260909042638_phase5_workflow_repairs.sql',
  '20260909043658_phase5_duplicate_trigger_acl.sql',
  '20260909145833_pre_hosting_v1_multiday_reports_upload_hardening.sql',
  '20260910021330_hosted_mobile_security_hardening.sql',
  '20260910044904_final_hosted_uat_admin_controls.sql',
  '20260910202541_allow_optional_event_contact_and_location.sql',
  '20260921012939_submission_status_dashboard.sql',
  '20260921121146_enforce_v1_home_caps.sql',
  '20260921124235_restrict_issues_to_super_admin.sql',
  '20260923142441_repair_manage_user_role_authorization.sql',
  '20260924164542_complete_opportunity_submission_workflow.sql',
  '20260927234958_add_apply_asap_availability_review.sql',
  '20260928134549_submission_clarity_and_super_admin_parser_feedback.sql',
  '20260929181148_add_organization_addition_issue_type.sql',
  '20260929200810_repair_submission_status_dashboard.sql',
  '20260929204959_structure_organization_addition_requests.sql',
  '20260929212940_homepage_announcement_highlight_control.sql',
  '20261002205205_restrict_contributor_approvals_to_admins.sql',
  '20261002214500_align_organization_request_validation.sql',
  '20261003133848_final_v1_uat_notifications_and_lifecycle.sql',
  '20261004130119_reviewer_submission_identity.sql',
  '20261004130844_repair_reviewer_submission_identity.sql',
  '20261004135624_separate_organization_taxonomy.sql',
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
const rlsAutoEnableHardening = readMigration('20260908180317_revoke_public_execute_rls_auto_enable.sql');
const selfReviewHardening = readMigration('20260908184025_prevent_reviewer_self_review.sql');
const dataApiPrivileges = readMigration('20260909001132_normalize_v1_data_api_privileges.sql');
const workflowRepairs = readMigration('20260909042638_phase5_workflow_repairs.sql');
const workflowTriggerAcl = readMigration('20260909043658_phase5_duplicate_trigger_acl.sql');
const preHosting = readMigration('20260909145833_pre_hosting_v1_multiday_reports_upload_hardening.sql');
const finalHostedUat = readMigration('20260910044904_final_hosted_uat_admin_controls.sql');
const optionalEventFields = readMigration('20260910202541_allow_optional_event_contact_and_location.sql');
const submissionStatus = readMigration('20260921012939_submission_status_dashboard.sql');
const v1HomeCaps = readMigration('20260921121146_enforce_v1_home_caps.sql');
const issueAccess = readMigration('20260921124235_restrict_issues_to_super_admin.sql');
const roleManagementRepair = readMigration('20260923142441_repair_manage_user_role_authorization.sql');
const opportunitySubmissionWorkflow = readMigration('20260924164542_complete_opportunity_submission_workflow.sql');
const applyAsapAvailability = readMigration('20260927234958_add_apply_asap_availability_review.sql');
const submissionClarity = readMigration('20260928134549_submission_clarity_and_super_admin_parser_feedback.sql');
const submissionStatusRepair = readMigration('20260929200810_repair_submission_status_dashboard.sql');
const organizationRequestStructure = readMigration('20260929204959_structure_organization_addition_requests.sql');
const homepageAnnouncementHighlight = readMigration('20260929212940_homepage_announcement_highlight_control.sql');
const organizationTaxonomy = readMigration('20261004135624_separate_organization_taxonomy.sql');

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
for (const hardeningControl of ["to_regprocedure('public.rls_auto_enable()')", 'revoke execute on function public.rls_auto_enable() from public']) assert.ok(rlsAutoEnableHardening.includes(hardeningControl), `RLS auto-enable hardening control missing: ${hardeningControl}`);
for (const selfReviewControl of ['record_review_evidence', 'review_content', 'request_review_correction', 'target_submitter_id = actor.id', 'Reviewers cannot review or modify review evidence for their own submission']) assert.ok(selfReviewHardening.includes(selfReviewControl), `Self-review hardening control missing: ${selfReviewControl}`);
assert.equal((selfReviewHardening.match(/target_submitter_id = actor\.id/g) || []).length, 3, 'Every review entry point must enforce the self-review guard');

for (const aclControl of [
  'revoke all privileges on table',
  'from anon, authenticated',
  'grant select on table public.user_roles to authenticated',
  'grant select, insert, update on table public.intake_sessions to authenticated',
  'grant select, insert, update, delete on table public.source_artifacts to authenticated',
  'grant select, insert on table public.field_suggestions to authenticated',
  'alter policy "contributors read own opportunities" on public.opportunities to authenticated',
  'alter policy "owners upload intake sources to bound path" on storage.objects to authenticated',
]) assert.ok(dataApiPrivileges.includes(aclControl), `Data API ACL control missing: ${aclControl}`);
assert.doesNotMatch(dataApiPrivileges, /grant\s+all/i, 'Application-facing roles must never receive GRANT ALL');

for (const workflowControl of [
  "'needs_correction','resubmitted'",
  'contributors edit own returned opportunities',
  'resubmit_corrected_content',
  "registration_link=case when p_changes?'source_url'",
  "link=case when p_changes?'source_url'",
  'possible_duplicate boolean not null default false',
  "recurrence_type = 'weekly'",
]) assert.ok(workflowRepairs.includes(workflowControl), `Phase 5 workflow control missing: ${workflowControl}`);
assert.doesNotMatch(workflowRepairs, /grant\s+all/i, 'Workflow repair must never grant broad privileges');
assert.ok(workflowTriggerAcl.includes('revoke all on function public.flag_possible_duplicate() from public, anon, authenticated'), 'Duplicate trigger function must not be callable through the Data API');
for (const control of ['add column if not exists end_date date', 'create table public.issue_reports', 'alter table public.issue_reports enable row level security', 'anyone creates open issue reports', 'admins read issue reports', 'add column if not exists source_text text', 'allowed_mime_types']) assert.ok(preHosting.includes(control), `Pre-hosting control missing: ${control}`);
assert.doesNotMatch(preHosting, /grant\s+all/i, 'Pre-hosting migration must not grant broad privileges');
for (const control of ['manage_home_event', 'hard_delete_content', 'update_my_display_name', 'Home Spotlight is limited to 5 items']) assert.ok(finalHostedUat.includes(control), `Final hosted UAT control missing: ${control}`);
assert.match(finalHostedUat, /if not public\.is_super_admin\(\)/, 'Permanent deletion must be restricted to super_admin');
assert.match(finalHostedUat, /revoke all on function public\.hard_delete_content\(text,uuid,text\) from public,anon,authenticated/, 'Permanent deletion RPC must be fail-closed by default');
assert.doesNotMatch(finalHostedUat, /grant\s+all/i, 'Final hosted UAT migration must not grant broad privileges');
for (const column of ['location', 'contact_name', 'contact_email']) {
  assert.match(optionalEventFields, new RegExp(`alter column ${column} drop not null`), `Event ${column} must become nullable`);
}
assert.doesNotMatch(optionalEventFields, /policy|grant|revoke|organization|drop\s+column/i, 'Optional Event fields migration must not alter authorization, organization requirements, or remove columns');
for (const control of ['relationship_details jsonb', 'submission_dashboard_dismissals', 'get_my_submission_status', 'dismiss_own_submission', 'security definer', 'review_verification_evidence']) assert.ok(submissionStatus.includes(control), `Submission status control missing: ${control}`);
assert.doesNotMatch(submissionStatus, /grant\s+all/i, 'Submission status migration must not grant broad privileges');
for (const control of ['enforce_v1_home_content_state', 'Home Spotlight is limited to 3 active items', 'limited to 7 active items', 'pg_advisory_xact_lock', "new.status <> 'published'"]) assert.ok(v1HomeCaps.includes(control), `V1 home cap control missing: ${control}`);
assert.match(v1HomeCaps, /revoke all on function public\.manage_home_spotlight\(text,uuid,boolean,smallint\) from public,anon/, 'Spotlight management must remain fail-closed for public and anonymous callers');
assert.doesNotMatch(v1HomeCaps, /grant\s+all/i, 'V1 home cap migration must not grant broad privileges');
for (const control of ['drop policy if exists "admins read issue reports"', 'super admins read issue reports', 'super admins update issue reports', 'public.is_super_admin()']) assert.ok(issueAccess.includes(control), `Super Admin issue access control missing: ${control}`);
assert.doesNotMatch(issueAccess, /delete\s+from|truncate|drop\s+table/i, 'Issue access migration must preserve issue records and history');
for (const control of [
  "actor.role not in ('admin', 'super_admin')",
  'Active administrator role required',
  "actor.role = 'admin'",
  "p_role not in ('contributor', 'reviewer')",
  "target.role in ('admin', 'super_admin')",
  "p_role <> 'super_admin' or p_status <> 'active'",
  "set search_path = ''",
  'revoke all on function public.manage_user_role(uuid, text, text)',
  'from public, anon, authenticated',
  'grant execute on function public.manage_user_role(uuid, text, text)',
  'to authenticated',
]) assert.ok(roleManagementRepair.includes(control), `Role-management repair control missing: ${control}`);
assert.doesNotMatch(roleManagementRepair, /grant\s+all|service_role/i, 'Role-management repair must not broaden privileges or introduce service-role access');
for (const control of [
  'alter column deadline drop not null',
  'deadline_type text not null',
  'opportunities_deadline_state_check',
  'enforce_v1_announcement_home_state',
  "jsonb_build_object('title',o.title,'org',o.org,'deadline_type',o.deadline_type",
]) assert.ok(opportunitySubmissionWorkflow.includes(control), `Opportunity submission workflow control missing: ${control}`);
assert.doesNotMatch(opportunitySubmissionWorkflow, /drop\s+table|delete\s+from|truncate|grant\s+all/i, 'Opportunity workflow migration must be additive and non-destructive');
for (const control of [
  'opportunity_availability_reviews',
  'enable row level security',
  'public.is_super_admin()',
  'revoke all on table public.opportunity_availability_reviews from public, anon',
]) assert.ok(applyAsapAvailability.includes(control), `Apply ASAP availability control missing: ${control}`);
assert.doesNotMatch(applyAsapAvailability, /alter\s+table\s+public\.opportunities|drop\s+table|truncate|grant\s+all/i, 'Availability maintenance must remain private and additive');
for (const control of [
  'manage_home_announcement',
  "role in ('admin', 'super_admin')",
  'Only published announcements can be highlighted on the homepage',
  'revoke all on function public.manage_home_announcement(uuid, boolean) from public, anon',
  'grant execute on function public.manage_home_announcement(uuid, boolean) to authenticated',
]) assert.ok(homepageAnnouncementHighlight.includes(control), `Homepage announcement highlight control missing: ${control}`);
assert.doesNotMatch(homepageAnnouncementHighlight, /grant\s+all|service_role|delete\s+from|truncate/i, 'Homepage announcement highlighting must remain scoped and non-destructive');
for (const control of ['add column if not exists posted_date date', 'super admins read parser feedback', "role = 'super_admin'", 'get_my_submission_status']) assert.ok(submissionClarity.includes(control), `Submission clarity control missing: ${control}`);
assert.doesNotMatch(submissionClarity, /drop\s+table|truncate|delete\s+from|grant\s+all/i, 'Submission clarity migration must preserve data and least privilege');
for (const control of [
  'create or replace function public.get_my_submission_status()',
  "set search_path = ''",
  'identity_roles',
  "'updated_at',s.created_at",
  'grant execute on function public.get_my_submission_status() to authenticated',
]) assert.ok(submissionStatusRepair.includes(control), `Submission-status repair control missing: ${control}`);
for (const missingColumn of ['e.updated_at', 'o.updated_at', 'a.updated_at']) assert.ok(!submissionStatusRepair.includes(missingColumn), `Submission-status repair references missing column: ${missingColumn}`);
assert.doesNotMatch(submissionStatusRepair, /drop\s+table|truncate|delete\s+from|grant\s+all/i, 'Submission-status repair must preserve stored submissions and least privilege');
for (const control of [
  'add column if not exists request_details jsonb',
  'validate_issue_report_request_details()',
  "set search_path = ''",
  '@pvamu[.]edu',
  'organization_name',
  'organization_abbreviation',
  'organization_relationship',
  'organization_email',
  'revoke all on function public.validate_issue_report_request_details()',
]) assert.ok(organizationRequestStructure.includes(control), `Organization-request structure control missing: ${control}`);
assert.doesNotMatch(organizationRequestStructure, /drop\s+table|truncate|delete\s+from|grant\s+all|security\s+definer/i, 'Organization-request structure must preserve data and avoid privileged code');
for (const control of ['taxonomy_scope', "'Council of Distinguished Engineers'", "'organization','affiliation','employer','other'", 'public reads active organization taxonomy']) assert.ok(organizationTaxonomy.includes(control), `Organization taxonomy control missing: ${control}`);
assert.doesNotMatch(organizationTaxonomy, /drop\s+table|truncate|delete\s+from|grant\s+all/i, 'Organization taxonomy migration must preserve history and least privilege');

console.log(`Migration bootstrap static checks passed: ${migrationNames.length} ordered migrations with a complete baseline.`);
