-- Normalize the V1 Data API surface to explicit least-privilege grants.
-- RLS remains the row-level authorization boundary for every reachable table.

begin;

-- Historical policies without an explicit TO clause applied to PUBLIC. Once
-- SELECT is restored for anon, PostgreSQL also authorizes subqueries/functions
-- in those private policies, which can block an otherwise valid public read.
-- Limit every identity/workflow policy to signed-in users; the published-row
-- and public-flyer policies intentionally remain public.
alter policy "contributors read own opportunities" on public.opportunities to authenticated;
alter policy "contributors submit own opportunities" on public.opportunities to authenticated;
alter policy "reviewers read all opportunities" on public.opportunities to authenticated;
alter policy "contributors read own events" on public.events to authenticated;
alter policy "contributors submit own events" on public.events to authenticated;
alter policy "reviewers read all events" on public.events to authenticated;
alter policy "contributors read own announcements" on public.announcements to authenticated;
alter policy "contributors submit own announcements" on public.announcements to authenticated;
alter policy "reviewers read all announcements" on public.announcements to authenticated;
alter policy "admins read audit events" on public.audit_events to authenticated;
alter policy "admins read digest runs" on public.digest_runs to authenticated;
alter policy "admins manage digest runs" on public.digest_runs to authenticated;
alter policy "owners and reviewers read intake sessions" on public.intake_sessions to authenticated;
alter policy "owners create intake sessions" on public.intake_sessions to authenticated;
alter policy "owners update open intake sessions" on public.intake_sessions to authenticated;
alter policy "owners and reviewers read source artifacts" on public.source_artifacts to authenticated;
alter policy "owners create artifacts for open intake" on public.source_artifacts to authenticated;
alter policy "owners modify artifacts for open intake" on public.source_artifacts to authenticated;
alter policy "owners delete artifacts for open intake" on public.source_artifacts to authenticated;
alter policy "owners and reviewers read suggestions" on public.field_suggestions to authenticated;
alter policy "owners create suggestions for open intake" on public.field_suggestions to authenticated;
alter policy "reviewers read aggregate engagement" on public.engagement_daily to authenticated;
alter policy "owners and reviewers read parser feedback" on public.intake_parser_feedback to authenticated;
alter policy "reviewers read own verification evidence" on public.review_verification_evidence to authenticated;
alter policy "users read bound role" on public.user_roles to authenticated;
alter policy "admins read all roles" on public.user_roles to authenticated;
alter policy "owners and reviewers read private intake sources" on storage.objects to authenticated;
alter policy "owners upload intake sources to bound path" on storage.objects to authenticated;
alter policy "owners delete open intake sources" on storage.objects to authenticated;
alter policy "verified contributors upload flyers" on storage.objects to authenticated;

-- Reset only the two application-facing Postgres roles. Internal Supabase roles
-- retain their platform-managed privileges.
revoke all privileges on table
  public.user_roles,
  public.opportunities,
  public.events,
  public.announcements,
  public.audit_events,
  public.digest_runs,
  public.intake_sessions,
  public.source_artifacts,
  public.field_suggestions,
  public.engagement_daily,
  public.intake_parser_feedback,
  public.contributor_access_requests,
  public.feature_recommendations,
  public.review_verification_evidence
from anon, authenticated;

-- Public pages read only published rows through the existing RLS policies.
grant select on table
  public.opportunities,
  public.events,
  public.announcements
to anon;

-- Signed-in users need public/queue reads and contributor submission inserts.
-- Review, publication, role management, analytics writes, and access-request
-- writes continue to use their narrowly granted SECURITY DEFINER RPCs.
grant select, insert on table
  public.opportunities,
  public.events,
  public.announcements
to authenticated;

-- Direct SELECT is safe because user_roles RLS exposes only the caller's bound
-- row, plus the full roster to admin/super_admin. These reads are also required
-- by the private intake-sources Storage policies.
grant select on table public.user_roles to authenticated;

grant select on table
  public.audit_events,
  public.engagement_daily,
  public.intake_parser_feedback,
  public.contributor_access_requests,
  public.feature_recommendations,
  public.review_verification_evidence
to authenticated;

grant insert on table public.feature_recommendations to authenticated;

grant select, insert, update on table public.intake_sessions to authenticated;
grant select, insert, update, delete on table public.source_artifacts to authenticated;
grant select, insert on table public.field_suggestions to authenticated;

-- digest_runs has no active V1 Data API caller. Its administrative policies are
-- retained for future use, but neither application-facing role can reach it.

commit;
