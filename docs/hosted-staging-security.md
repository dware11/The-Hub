# Hosted staging security notes

## SECURITY DEFINER inventory

All listed functions set an explicit trusted `search_path`. `anon` has access only to the two aggregate analytics functions. The application grants `authenticated` access only where the signed-in caller needs the operation. Mutation functions either bind work to `auth.uid()` or check an active application role before reading or writing protected rows.

| Function | Caller | Purpose | Why definer | Internal authorization / input safety | Expected grant | Coverage / decision |
|---|---|---|---|---|---|---|
| `get_public_opportunity_connections()` | anon, authenticated | Public application-click total | Reads a non-public aggregate table | No private fields or inputs; fixed content/action predicates | anon, authenticated | impact static + DB ACL; KEEP |
| `record_engagement(text,text,text)` | anon, authenticated | Increment privacy-safe daily aggregate | Public cannot write aggregate table directly | Enumerated type/action; constrained identifier; no identity stored | anon, authenticated | impact static + DB ACL; KEEP |
| `claim_my_role()` | authenticated | Bind a pre-approved role to a verified Auth user | Must read `auth.users` and update protected role row | Requires `auth.uid()` and confirmed email; binds only matching active, unbound email | authenticated | RBAC + ACL; KEEP |
| `has_active_role(text[])` | authenticated | Central role predicate used by RLS/functions | Must inspect protected role row | Matches `auth.uid()`, active status, and allowed role list | authenticated | RBAC + ACL; KEEP |
| `is_verified_contributor()` | authenticated | Contributor predicate | Wraps protected role lookup | Delegates to `has_active_role` with four allowed roles | authenticated | RBAC + intake; KEEP |
| `is_reviewer()` | authenticated | Reviewer predicate | Wraps protected role lookup | Delegates to `has_active_role` | authenticated | RBAC + review; KEEP |
| `is_admin()` | authenticated | Admin predicate | Wraps protected role lookup | Delegates to `has_active_role` | authenticated | RBAC + admin; KEEP |
| `is_super_admin()` | authenticated | Super-admin predicate | Wraps protected role lookup | Delegates to `has_active_role` | authenticated | RBAC + role management; KEEP |
| `get_access_request_export()` | authenticated | Reviewer-only access export | Joins protected requests/roles/content | Query is gated by `is_reviewer()` and returns no rows otherwise | authenticated | RBAC + access tests; KEEP |
| `get_engagement_metrics(integer)` | authenticated | Reviewer analytics | Reads protected aggregate table | Requires reviewer; days limited to null/7/30 | authenticated | impact + RBAC; KEEP |
| `get_feature_recommendations()` | authenticated | Admin recommendation queue | Reads protected recommendation identities | Query gated by `is_admin()` | authenticated | editorial + RBAC; KEEP |
| `get_parser_feedback_metrics(integer)` | authenticated | Reviewer parser-quality summary | Reads private feedback | Requires reviewer; days limited to null/7/30 | authenticated | intake + RBAC; KEEP |
| `get_people_access_roster()` | authenticated | Admin role roster | Reads protected identities and activity | Query gated by `is_admin()` | authenticated | people/RBAC; KEEP |
| `manage_announcement_editorial(...)` | authenticated | Admin editorial changes | Performs audited protected updates | Active admin/super-admin lookup; enumerated action/category/priority; URL check | authenticated | editorial + RBAC; KEEP |
| `manage_home_spotlight(...)` | authenticated | Admin Spotlight control | Updates protected published content | Active admin/super-admin check; enumerated type/rank constraints | authenticated | editorial + RBAC; KEEP |
| `manage_published_content(...)` | authenticated | Admin content maintenance | Audited cross-table update | Admin check; type/action allowlists and constrained changes | authenticated | workflow + RBAC; KEEP |
| `manage_user_role(uuid,text,text)` | authenticated | Controlled role/status changes | Must manage protected role rows and audit | Active actor; admin/super-admin limits; self/last-super-admin safeguards | authenticated | RBAC + ACL; KEEP |
| `provision_user_role(text,text,text)` | authenticated | Pre-provision role by email | Writes protected role rows | Requires super-admin; validates role/status | authenticated | RBAC + ACL; KEEP |
| `recommend_announcement_feature(uuid)` | authenticated | Reviewer recommendation | Writes protected recommendation | Active reviewer/admin/super-admin; published target required | authenticated | editorial + RBAC; KEEP |
| `record_review_evidence(...)` | authenticated | Save reviewer verification | Writes protected evidence | Reviewer check; prevents self-review; constrained decision | authenticated | review evidence + self-review tests; KEEP |
| `request_contributor_access(...)` | authenticated | Submit access request | Reads verified Auth email and upserts protected request | Confirmed email; enumerated inputs; PVAMU-contact rule | authenticated | access/RBAC; KEEP |
| `request_review_correction(text,uuid,text)` | authenticated | Reviewer correction request | Updates protected content/evidence/audit | Reviewer check; no self-review; state and reason validation | authenticated | workflow + self-review; KEEP |
| `resubmit_corrected_content(text,uuid)` | authenticated | Owner resubmission | Updates protected content/evidence/audit | Contributor check; exact owner and state required | authenticated | workflow + RBAC; KEEP |
| `review_content(text,uuid,text,text)` | authenticated | Publish/reject reviewed content | Updates protected content and audit | Reviewer check; no self-review; complete evidence gate | authenticated | workflow + self-review; KEEP |
| `review_contributor_access_request(uuid,text,text)` | authenticated | Approve/reject access | Reads Auth identity and writes protected RBAC tables | Reviewer check; pending target; identity-binding safeguards | authenticated | access/RBAC; KEEP |
| `save_intake_parser_feedback(uuid,text,text[],text)` | authenticated | Save owner feedback | Writes private parser feedback | Active contributor role (including super-admin); exact submitted-session owner; allowlists and length limits | authenticated | intake + hosted hardening; KEEP |

Trigger/operations-only definer functions (`archive_expired_opportunities`, `flag_possible_duplicate`, `rls_auto_enable`) have no `anon` or `authenticated` execute grant and remain restricted.

## Auth and operations

- A successfully authenticated external address remains roleless until an approved `user_roles` row is explicitly provisioned and bound. Authentication alone never grants Workspace access.
- Magic Link expiry and send-frequency limits are controlled in Supabase Auth and should be reviewed before production; the application does not override them.
- Require MFA for GitHub, Vercel, and Supabase administrators.
- Supabase provides platform backups according to the project plan; the Hub owner remains responsible for restore testing, retention requirements, and exports needed by the College.
- Revoke access by setting the `user_roles` status to `needs_review` (or changing the role through the approved People & Access flow), then revoke the user’s active Auth sessions when immediate invalidation is required.
- Review Supabase Security Advisor after every migration and at least monthly during operation.
- If public-form abuse exceeds the V1 in-runtime burst limits, add Vercel Firewall rate-limit rules or CAPTCHA at the public server boundary.
- Full malware scanning requires an external scanning service and is a post-V1 hardening item. Current V1 controls enforce private storage, extension/MIME/signature, actual byte size, and image dimension limits.
