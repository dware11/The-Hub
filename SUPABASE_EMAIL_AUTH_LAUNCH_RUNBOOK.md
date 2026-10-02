# Supabase email-auth launch runbook

The Hub uses Supabase passwordless typed email OTP codes. Outlook calendar links are ordinary prefilled web URLs and are unrelated to authentication or calendar-account access.

1. Create/link the Supabase project and run the ordered migrations. Keep the Site URL at `https://hub.codepv.org`; retain the existing `/auth/confirm` redirect entries temporarily for fallback testing.
2. Enable Auth → Providers → Email. Configure a verified sender/SMTP provider and use `{{ .Token }}` in both the Magic Link and Confirm signup templates so existing and newly created Auth users receive a six-digit code.
3. Configure only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DEMO_MODE=false`, `DEMO_MODE=false`, and optionally `NEXT_PUBLIC_CODE_CONTACT_EMAIL` for support messaging. Never expose a service-role key or SMTP secret in `NEXT_PUBLIC_*`.
4. First administrator: sign in once so a confirmed Supabase Auth identity exists. If this is a new environment with no active super administrator, the project owner runs the reviewed, one-time script with the email supplied at execution time:

```sh
psql "$DATABASE_URL" -v bootstrap_email='owner@example.edu' \
  -f supabase/bootstrap/first_super_admin.sql
```

The script requires a confirmed exact-email Auth user, refuses to run after an active super administrator exists, and records `initial_super_admin_bootstrapped` in the protected audit trail. Do not commit the email or database URL. After bootstrap, use normal application/RPC role management. Do not grant roles based only on `@pvamu.edu`.

5. Signed-out visitors who open `/submit/event` or `/submit/opportunity` receive an email code and return to that exact allowlisted path after verification. Signed-in viewers receive the contributor access-request form. Reviewer approval atomically grants `contributor`; reviewers do not need super-admin approval. `admin` and `super_admin` remain separate from contributor requests.
6. Committee testing must cover external guest email, PVAMU email without a role, contributor request, reviewer approval/rejection, role revocation, and blocked direct table/RPC edits. Verify private intake files remain signed and inaccessible to public users.
7. Configure optional generic Resend notifications only in the deployment dashboard (`RESEND_API_KEY`, verified `DIGEST_FROM_EMAIL`, and `REQUEST_NOTIFICATION_TO_EMAIL` or the existing digest recipient). Messages contain no requester names, emails, IDs, or source details; missing configuration is disabled and never blocks submissions or approvals.
8. Rollback: disable Email provider sign-in, revoke active roles, preserve audit rows, and use the prior app build. Do not delete auth users or intake files as a rollback shortcut.

## Typed OTP template invariant (pilot)

For the linked pilot project, use this concise code-first content in both Supabase Auth **Magic Link** and **Confirm signup** templates:

```html
<h2>C.O.D.E. Engineering Hub</h2>
<p>Your 6-digit sign-in code:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
<p>Enter this code in the Hub to finish signing in.</p>
<p>This code expires in 10 minutes and can be used only once.</p>
```

Do not include `{{ .ConfirmationURL }}` or `{{ .TokenHash }}` as the primary sign-in action. The normal flow verifies the submitted email and code with Supabase `verifyOtp`; Supabase still creates and persists the session. The existing account-admission behavior is preserved explicitly with `shouldCreateUser: true`, while Hub permissions continue to come only from RBAC/RLS. Keep Email OTP expiration at 600 seconds. During pilot testing, retain `https://code-engineering-hub-staging.vercel.app/auth/confirm` as a fallback redirect without exposing it in the normal UX.
