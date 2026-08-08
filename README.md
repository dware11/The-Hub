# C.O.D.E. Engineering Hub

Communications and opportunity platform for the Roy G. Perry College of
Engineering at Prairie View A&M University — opportunities (internships,
scholarships, research), a shared events calendar, announcements, and a
submission portal for verified contributors.

Runs in **demo mode** with zero configuration (sample data, a simulated
signed-in admin, everything walkable) and switches to live Supabase data
automatically once the env vars below are set.

## Stack

- Next.js 14 (App Router) + Tailwind CSS
- Supabase: Postgres + Row Level Security, Auth (Microsoft/Azure AD),
  Storage (flyer uploads)
- Tesseract.js for client-side flyer OCR, plain regex for field extraction
- Resend for the weekly digest email
- Vercel for hosting (needs server-side rendering + DB writes at request
  time — GitHub Pages, being static-only, can't run this)

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run all of `supabase/schema.sql`. This creates
   the tables, the `flyers` storage bucket, and all RLS policies —
   including the `is_admin()` / `is_verified_contributor()` checks that
   gate submissions and the review queue at the database level (not just
   in the UI).
3. Copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   Project Settings → API.

## 2. Microsoft (Azure AD) sign-in

1. In [Supabase Auth providers](https://supabase.com/dashboard/project/_/auth/providers),
   enable **Azure**.
2. In the [Azure Portal](https://portal.azure.com) → App registrations,
   register a new app. Add a redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Under Certificates & secrets, create a client secret. Copy the
   Application (client) ID and secret into the Supabase Azure provider
   config, along with your Azure AD tenant ID (or `common` for any
   Microsoft account, `organizations` for any work/school account).
4. Verified contributors are managed manually in `user_roles` — sign-in
   alone doesn't grant posting access. After someone signs in once, add a
   row for their email with `status = 'active'` and the right `role`
   (`admin`, `faculty`, `org_president`, or `student`). Until then they'll
   see "not yet a verified contributor" on `/submit`.

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

`archive_expired_opportunities()` (in `schema.sql`) moves opportunities to
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
