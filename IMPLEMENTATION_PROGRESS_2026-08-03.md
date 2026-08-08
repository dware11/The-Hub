# Panther Hub Senior Engineering Implementation Progress

**Date:** August 3, 2026  
**Scope:** Content-type branching and multi-source intake vertical slice

## Starting point

The inherited prototype had:

- A single submission page with event, opportunity, and announcement tabs
- One pasted-text input or one image input
- Image OCR through Tesseract.js
- Basic regex extraction for title, dates, email, URL, location, and presenter
- No ability to process pasted text and an image together
- No PDF intake
- No distinction between submitter, referrer, opportunity owner, and public contact
- No field-level provenance
- No source precedence or conflict reporting
- Browser-controlled submission ownership
- Public flyer storage
- No multi-source intake records
- No structured source metadata

## Implemented in this slice

### New contributor route

`/panther-submit`

The new route is intentionally separate from legacy `/submit` while the Google
Drive synchronization layer prevents controlled modification of pre-existing
files.

### Four-step workflow

1. Choose Event, Opportunity, or Announcement
2. Identify relationship to the source
3. Add multiple sources
4. Confirm student-facing details

### Relationship and provenance

The flow distinguishes:

- Original opportunity contact
- PVAMU department/faculty/staff referral
- Student organization referral
- Sponsor referral
- Alumni referral
- External discovery
- Other

Referral name, title, organization, email, and display permission are stored
separately from the submitter and public contact.

### Multi-source support

- Up to three artifacts
- Up to 25 MB combined
- PDF up to 15 MB
- Images up to 10 MB each
- PNG, JPEG, WebP, and PDF validation
- Decoded image pixel protection
- Pasted text alongside files
- Actionable error messages and manual-entry fallback

### Parser merge behavior

- Every image/text source is processed independently
- Flyer/program sources receive priority for program facts
- Email/post screenshots contribute referral and audience context
- Per-field provenance is retained
- Different values create reviewer warnings
- Parser failures do not block manual submission
- Suggested categories, majors, sectors, paid status, work modes, and selected qualifications are generated

### Type-aware confirmation

Event confirmation focuses on:

- Date
- Time
- Location
- Host
- Registration
- Audience

Opportunity confirmation focuses on:

- Deadline
- Employer/program
- Category
- Paid/funded status
- Location
- Application link
- Majors

Announcement confirmation remains short.

### Server trust boundary

- Intake creation requires an authenticated, active contributor
- Submitter identity is derived server-side
- File metadata is revalidated server-side
- Private signed upload URLs are created server-side
- Final records always enter pending review
- The browser cannot choose `submitted_by`

### Database additions

- `intake_sessions`
- `source_artifacts`
- `field_suggestions`
- Content-to-intake relationships
- Private `intake-sources` bucket
- Contributor/admin RLS policies
- Storage ownership policies

## Implemented but not yet runtime verified

The new JavaScript files passed standalone syntax checks. A full Next.js build
could not run because:

1. Docker Desktop's Linux engine is not running.
2. `npm ci` on the Google Drive workspace failed with repeated archive-write,
   `EBADF`, and `EPERM` filesystem errors.

The implementation must not be described as production verified until a clean
build runs from a normal local filesystem or an active Docker engine.

## Deliberate partial implementation

PDF files are now accepted, privately modeled, and uploadable, but PDF text
extraction is not connected. The parser returns a clear warning and continues
with screenshots, images, pasted text, or manual entry. This preserves graceful
degradation without claiming unsupported PDF parsing.

## Remaining before replacing legacy `/submit`

1. Run database migrations in a disposable Supabase test project.
2. Complete a clean production build.
3. Add the server PDF text/OCR adapter.
4. Add PDF page-count and active-content validation.
5. Persist source processing completion after upload.
6. Build reviewer signed-file access and side-by-side provenance display.
7. Expand the canonical category model to include fellowship, employment,
   professional development, and other directive categories without coercion.
8. Add automated tests for ownership, RLS, parsing, upload limits, and manual fallback.
9. Replace or redirect legacy `/submit` after acceptance testing.
10. Update navigation to the new route.

## Engineering assessment

The platform has moved from a single-source form prototype to an implemented
multi-source intake vertical slice with a real server trust boundary and a
normalized source/provenance model. It is substantially closer to the approved
Panther Hub workflow, but it is not yet launch-ready because runtime build,
database migration, reviewer access, and PDF extraction remain unverified or
incomplete.
