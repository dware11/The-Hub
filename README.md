# C.O.D.E. Engineering Hub

Communications and opportunity platform for the Roy G. Perry College of
Engineering at Prairie View A&M University — opportunities (internships,
scholarships, research), a shared events calendar, announcements, and a
submission portal for verified contributors.

Runs in **demo mode only when both demo flags are explicitly enabled**
(sample data and a simulated signed-in admin). Production must set both
flags to false and provide live Supabase configuration.

## Stack

- Next.js 14 (App Router) + Tailwind CSS
- Supabase: Postgres + Row Level Security, passwordless email Auth,
  Storage (flyer uploads)
- Tesseract.js for client-side flyer OCR, plain regex for field extraction
- Resend for the weekly digest email
- Vercel for hosting (needs server-side rendering + DB writes at request
  time — GitHub Pages, being static-only, can't run this)

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. For a new empty project, link the Supabase CLI and run `supabase db push`.
   The ordered history in `supabase/migrations` begins with a complete
   baseline migration, so `supabase/schema.sql` must not be pasted into the
   SQL Editor first. The migration chain creates the tables, storage buckets,
   functions, triggers, and RLS policies —
   including the `is_admin()` / `is_verified_contributor()` checks that
   gate submissions and the review queue at the database level (not just
   in the UI).
3. Copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   Project Settings → API.

## 2. Passwordless email sign-in

1. In Supabase Auth → Providers → Email, enable email OTP/magic links and
   configure the SMTP sender appropriate for the pilot.
2. Add the deployed site's `/auth/confirm` URL to the Supabase redirect allowlist.
3. Roles are pre-provisioned or granted through the Website Committee; a
   PVAMU email suffix proves mailbox control only and never grants a role.
4. Review `SUPABASE_EMAIL_AUTH_LAUNCH_RUNBOOK.md` for templates, redirects,
   access requests, first-admin provisioning, testing, and rollback.

## 3. Weekly digest email (Resend)

1. Create a free account at [resend.com](https://resend.com) and verify a
   sending domain.
2. Set `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` (must be on the verified
   domain), and `DIGEST_TO_EMAIL` (comma-separated for multiple
   recipients, e.g. a Google Group) in your env vars.
3. On Vercel, the schedule in `vercel.json` (`0 13 * * 1` — Mondays,
   13:00 UTC) triggers `GET /api/cron/weekly-digest` automatically once
   deployed; no separate setup needed. Set `CRON_SECRET` in your Vercel
   project env vars to stop the endpoint from being callable by anyone
   who finds the URL — Vercel Cron sends it automatically as a bearer
   token.

## 4. Auto-archive (pg_cron)

`archive_expired_opportunities()` (created and hardened by the migration chain) moves opportunities to
`archived` 15 days after their deadline. Schedule it in the Supabase SQL
editor:

```sql
select cron.schedule(
  'archive-expired-opportunities',
  '0 0 * * *', -- daily at midnight UTC
  $$ select archive_expired_opportunities(); $$
);
```

(Requires the `pg_cron` extension, enabled under Database → Extensions.)

## Privacy-safe engagement metrics

The Hub stores UTC daily aggregate interaction counts only. It does not store
IP addresses, account IDs, email addresses, user agents, referrers, cookies,
device identifiers, or exact interaction timestamps. Counts are interactions,
not unique people, and may include reloads or automated traffic.

The homepage's **Panther opportunity connections** value means recorded
outbound application-link clicks only; it does not claim applications or
unique students. Reviewer impact metrics also show opportunity/event detail
views, source and registration actions, calendar actions, and announcement
list-page views for the trailing 7 days, trailing 30 days, and all time.

## Private intake evidence and optional parser feedback

`/submit` is permanently redirected to `/panther-submit`; the legacy form and
its public-flyer upload action are retired. A live project created from an
older schema may still contain the public `flyers` bucket and its legacy
policies. An operator must inventory existing objects, preserve any records
that are still referenced, and then remove or privatize that bucket/policies
through a separately reviewed production migration. Do not delete live files
without that inventory.

Authorized reviewers receive 10-minute signed links to private intake source
files plus parser provider/version, field suggestions, confidence, and review
reasons. This evidence remains protected by the existing owner/reviewer RLS
model and is not included on public pages.

After successful intake, contributors may optionally rate extraction and mark
which field categories needed attention. Feedback stores only the rating,
selected field keys, and an optional 500-character note; it does not store
corrected values, copied document text, email, IP address, user agent, or a
device/browser identifier. Set `NEXT_PUBLIC_ENABLE_PARSER_FEEDBACK=false` in
the deployment dashboard to hide this prompt. It defaults on for demo and
testing. Feedback failure never rolls back or blocks the completed submission.

## 5. Flyer parsing — how it works, and the upgrade path

`lib/flyerParser.js` has a single entry point, `parseFlyer({ text,
imageFile })`, with a fixed contract: give it pasted text or an uploaded
image, get back structured fields (`title`, `date`, `time`, `deadline`,
`location`, `contactName`, `contactEmail`, `link`, `presenterName`,
`presenterAffiliation`) plus which ones it's confident about. Today that's
Tesseract.js (OCR, runs in the browser, no API key) feeding a regex/keyword
extractor — fully free, as specced.

If regex extraction proves too unreliable on real flyers, swap the body of
`parseFlyer` for a single vision-capable LLM call (Claude Haiku or Gemini
Flash-Lite — check current pricing before picking) that returns the same
`fields` shape. Nothing outside `lib/flyerParser.js` needs to change — the
submit form only ever calls `parseFlyer`.

## Local development

```bash
npm install
npm run dev
```

Runs in demo mode with no env vars at all. Copy `.env.local.example` to
`.env.local` and fill it in to go live.

## Deploying

Push to a GitHub repo and import it on [Vercel](https://vercel.com). Add
all the env vars from `.env.local.example` in the Vercel project settings.
`vercel.json` wires up the weekly digest cron automatically.

## What's Phase 2 (not built here)

Student profiles, personalized feeds, and a sponsor portal are explicitly
out of scope for this build.
