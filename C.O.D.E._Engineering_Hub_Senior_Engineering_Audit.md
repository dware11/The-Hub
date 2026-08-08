# C.O.D.E. Engineering Hub

## Comprehensive Senior Engineering Architecture, Security, Operations, and API-Readiness Report

**Prepared for:** C.O.D.E. leadership, the Roy G. Perry College of Engineering, Prairie View A&M University  
**Review perspective:** Senior software engineering and institutional platform readiness  
**Repository reviewed:** `G:\My Drive\C.O.D.E. Engineering Hub`  
**Review date:** July 26, 2026  
**Assessment type:** Source-code and architecture audit  

---

## 1. Purpose of This Report

This report explains what the C.O.D.E. Engineering Hub is, how it works, what has actually been implemented, what remains conceptual, what is technically strong, what creates institutional risk, and what should happen before a production launch.

It is written for two audiences:

1. A technical reader who needs to understand the implementation well enough to maintain or extend it.
2. A college leader—such as the Dean of Engineering—who needs clear answers about ownership, security, moderation, privacy, reliability, scalability, and future capabilities.

This report also answers a specific architecture question: whether the current implementation intentionally preserves a future integration point for API-based flyer parsing, including AI or vision-model parsing.

The short answer is yes. There is a deliberate parser boundary. However, the existing boundary needs a server-side adapter, response validation, audit metadata, and operational controls before it can safely support a production external AI API.

---

## 2. Executive Summary

The C.O.D.E. Engineering Hub is a moderated communications and opportunity platform for the Roy G. Perry College of Engineering. It consolidates information that would otherwise be distributed through email, flyers, student organizations, faculty contacts, and separate calendars.

The current platform supports:

- Opportunities such as internships, co-ops, scholarships, research, and competitions
- College and student-organization events
- College-wide announcements
- Microsoft-based sign-in
- Manually verified contributor accounts
- Flyer and pasted-text parsing
- Original flyer preservation
- Administrative review and approval
- Public publication of approved content
- Major-based filtering
- Calendar display and downloadable calendar files
- A scheduled weekly digest through Resend
- Automatic archival of expired opportunities
- A zero-configuration demonstration mode

The platform has a sensible foundational architecture:

- Next.js provides the website, server-rendered pages, server actions, and scheduled route.
- Supabase provides authentication, PostgreSQL data storage, Row Level Security, and flyer storage.
- Microsoft/Azure AD provides identity.
- Tesseract.js performs browser-side OCR.
- A local parser converts OCR or pasted text into structured fields.
- Administrators review submissions before publication.
- Resend sends the weekly digest.
- Vercel is the intended hosting environment.

The design correctly treats authentication, contributor authorization, moderation, and publication as separate responsibilities. It also intentionally uses database security policies as the primary authorization boundary rather than relying entirely on the interface.

However, the implementation should currently be classified as a strong prototype or controlled pilot, not an institutionally production-ready system.

The most important issues are:

1. A contributor can technically submit a record with another contributor’s identifier because submission ownership is not bound to the authenticated account in the database policy.
2. Demo data can silently replace real data when live database queries fail.
3. Missing production environment variables automatically enable a simulated administrator experience.
4. Original flyers are uploaded to a public storage bucket before approval.
5. There is no comprehensive server-side validation layer.
6. The weekly email process is not idempotent and can send duplicates.
7. The approval process does not produce a durable institutional audit trail.
8. There are no automated tests in the repository.
9. The dependency installation and production build could not be completed during this audit, and no committed dependency lockfile was present.

None of these problems invalidate the overall platform concept. They are correctable hardening tasks. The architecture can evolve into a reliable institutional service without requiring a complete rewrite.

---

## 3. Overall Readiness Judgment

### 3.1 Current classification

**Recommended classification:** Demonstration-ready and suitable for a limited supervised pilot after immediate security corrections.

### 3.2 Not yet recommended for

- Unsupervised college-wide production use
- Reliance as the authoritative source of deadlines
- Handling confidential or regulated documents
- Automated publication without human review
- High-volume external contributor access
- Institutional audit or compliance claims
- Guaranteed weekly email delivery
- AI parsing involving external vendors without privacy review

### 3.3 Why the concept remains strong

The major risks are primarily enforcement, observability, validation, and operational-governance gaps. The functional decomposition itself is reasonable. Authentication, content, moderation, parsing, storage, and email responsibilities are already separated enough to support incremental improvement.

---

## 4. Platform Mission and Institutional Value

The platform addresses a common college communications problem: useful engineering information is fragmented across inboxes, flyers, learning platforms, group chats, student organizations, departments, career offices, and individual faculty members.

The Hub attempts to create one moderated destination where students can discover:

- What opportunities are available
- Which majors an opportunity applies to
- When applications close
- What events are happening
- Where an event occurs
- Who owns or submitted the information
- Who students should contact
- Whether a posting has been reviewed
- Where the original source flyer can be viewed

The intended institutional value is not merely website publishing. It is information normalization:

```text
Unstructured source
    Flyer, screenshot, email, or pasted text
                    ↓
Contributor review and structured fields
                    ↓
Administrative review
                    ↓
Published opportunity, event, or announcement
                    ↓
Website, calendar, and weekly digest
```

That normalization makes information searchable, filterable, reusable, and eventually available to other systems through APIs.

---

## 5. Technology Stack

### 5.1 Application framework

The application uses Next.js 14 with the App Router and React 18.

Next.js is responsible for:

- Page rendering
- Route handling
- Server components
- Server actions
- Authentication callback routes
- The scheduled digest endpoint
- Middleware-based session refresh

### 5.2 Styling

Tailwind CSS provides the interface styling and the custom Prairie View/C.O.D.E.-oriented color system.

### 5.3 Data and security platform

Supabase provides:

- PostgreSQL
- Row Level Security
- Microsoft/Azure authentication integration
- Browser and server clients
- Public flyer storage

### 5.4 Parsing

Tesseract.js performs OCR in the browser. A custom regular-expression and keyword parser converts recognized text into proposed fields.

### 5.5 Email

Resend is called through a scheduled Next.js route to send the weekly digest.

### 5.6 Hosting

Vercel is the intended host because the platform requires server-rendered execution, scheduled functions, authentication callbacks, database operations, and email API calls.

---

## 6. Repository Organization

The repository is compact and organized by responsibility.

### `app/`

Contains the routes and pages:

- Home page
- Opportunity list and detail pages
- Event list and detail pages
- Announcements
- Submission page
- Administrative review page
- Authentication callback, sign-out, and error routes
- Weekly digest route

### `components/`

Contains interactive interface components:

- Navigation
- Microsoft sign-in button
- Submission form
- Events calendar
- Major filter

### `lib/`

Contains application logic:

- Authentication helpers
- General data access
- Administrative data access
- Flyer parsing and OCR
- Flyer storage
- Supabase clients
- Email template
- Sample data

### `supabase/`

Contains the PostgreSQL schema, helper functions, Row Level Security policies, and storage policies.

### Root configuration

Contains:

- Next.js configuration
- Tailwind configuration
- Vercel cron configuration
- Middleware
- Environment variable example
- README
- Package manifest

---

## 7. End-to-End Operational Workflow

## 7.1 Public reading workflow

An unauthenticated visitor may browse:

- Published opportunities
- Published events
- Published announcements
- Individual opportunity and event details

The application queries Supabase for rows whose status is `published`. The PostgreSQL Row Level Security policies also allow public reads only when content is published.

This duplication is good:

- The application asks for published data.
- The database independently refuses unpublished data.

The public interface displays structured information such as title, deadline, location, organization, contact, majors, registration link, and original flyer.

## 7.2 Authentication workflow

A user selects “Sign in.”

The browser calls Supabase Auth with the Azure provider and requests:

- Email
- OpenID identity
- Profile information

Microsoft authenticates the user. Supabase redirects back to:

`/auth/callback`

The callback exchanges the temporary authentication code for a Supabase session and stores the resulting session in cookies.

Middleware refreshes the Supabase session on later requests so server-rendered pages receive current user information.

## 7.3 Authorization workflow

Microsoft authentication answers:

> Who is this user?

The `user_roles` database table answers:

> What is this user allowed to do?

The table supports these roles:

- `admin`
- `faculty`
- `org_president`
- `student`

It also supports:

- `active`
- `needs_review`

A signed-in user is not automatically a contributor. The user must have a role row whose status is `active`.

This is a sound institutional control because possession of a university Microsoft account should not automatically permit college-wide publication.

## 7.4 Submission workflow

An active contributor reaches the submission form and chooses:

- Opportunity
- Event
- Announcement

For opportunities and events, the contributor may:

- Paste text
- Upload a flyer, screenshot, or image
- Manually complete the form

If an image is uploaded, Tesseract performs OCR locally in the browser. The parser then tries to identify:

- Title
- Date
- Time
- Deadline
- Location
- Contact name
- Contact email
- Link
- Presenter name
- Presenter affiliation

Detected fields are inserted into the editable form. The contributor remains responsible for filling missing fields and correcting detected values.

The form also:

- Defaults the contact name and email from the signed-in account
- Requires confirmation before publishing a contact email
- Warns when the contact email is outside `pvamu.edu`
- Allows major targeting
- Captures opportunity or event type
- Captures the original flyer

After submission, the record receives `pending` status.

## 7.5 Flyer storage workflow

If an image was uploaded, the browser uploads it to the Supabase `flyers` bucket.

The storage path is based on:

- Current timestamp
- Sanitized original filename

The public URL is saved in the opportunity or event record as `flyer_url`.

This URL is later displayed on the detail page and in the administrative review queue.

## 7.6 Moderation workflow

An administrator visits the review queue.

The page verifies that:

- A user is signed in
- The user’s active role is `admin`

The queue retrieves pending:

- Opportunities
- Events
- Announcements

The administrator may approve or reject an item.

The browser invokes a server action. That server action retrieves the viewer again and rejects the action if the viewer is not an administrator.

The server then asks Supabase to update the status.

Supabase Row Level Security independently verifies administrator status.

Approval changes the status to `published`. Opportunities and events also receive `verified = true`.

Rejection changes the status to `rejected`.

## 7.7 Weekly digest workflow

Vercel is configured to request:

`/api/cron/weekly-digest`

at 13:00 UTC every Monday.

The route:

1. Optionally validates a bearer secret.
2. Checks Resend configuration.
3. Retrieves up to four closing-soon opportunities.
4. Retrieves up to three upcoming events.
5. Retrieves up to two pinned or recent announcements.
6. Builds an HTML email.
7. Sends the message using the Resend API.

## 7.8 Opportunity archival workflow

The database includes `archive_expired_opportunities()`.

When scheduled through `pg_cron`, this function changes published opportunities to `archived` 15 days after their deadline.

This allows recently expired information to remain visible temporarily while preventing indefinitely stale opportunity listings.

---

## 8. Data Model

## 8.1 User roles

The `user_roles` table stores:

- Unique identifier
- Email
- Role
- Organization
- Full name
- Status
- Creation timestamp

It does not create the authentication identity. Supabase Auth owns identity; this table stores application authorization.

## 8.2 Opportunities

Opportunity records include:

- Title
- Organization
- Opportunity type
- Paid/unpaid indicator
- Applicable majors
- Description
- Deadline
- Location
- Application link
- Contact name
- Contact email
- Optional LinkedIn contact
- Original flyer URL
- Submitter reference
- Moderation status
- Verified indicator
- Creation timestamp

## 8.3 Events

Event records include:

- Title
- Event type
- Applicable majors
- Description
- Date
- Time
- Location
- Registration link
- Presenter name
- Presenter affiliation
- Alumni-presenter indicator
- Sponsor-presenter indicator
- Contact name
- Contact email
- Owning organization
- Original flyer URL
- Submitter reference
- Moderation status
- Verified indicator
- Creation timestamp

## 8.4 Announcements

Announcement records include:

- Source
- Title
- Body
- Pinned indicator
- Emailed-this-week indicator
- Submitter reference
- Moderation status
- Creation timestamp

## 8.5 Status model

Opportunities support:

- `pending`
- `published`
- `rejected`
- `archived`

Events and announcements support:

- `pending`
- `published`
- `rejected`

The model does not currently support:

- Drafts
- Scheduled publication
- Revision requested
- Withdrawn
- Superseded
- Resubmitted
- Soft deletion

Those may become relevant as contributor volume increases.

---

## 9. Security Architecture

## 9.1 Positive controls

The implementation includes several correct security decisions:

- Authentication uses an established identity provider.
- Contributor access requires a manually active role.
- Administrative status is checked in application code.
- Administrative status is also checked in database policies.
- Public database policies limit reads to published rows.
- The application does not use a service-role key for ordinary operations.
- The weekly digest key is server-side.
- Contributor checks occur in database helper functions.
- Row Level Security is enabled on the primary tables.

## 9.2 Security boundary

The intended enforcement hierarchy is:

```text
Interface restrictions
        ↓
Server/page authorization checks
        ↓
Supabase authenticated session
        ↓
PostgreSQL Row Level Security
```

The database should be treated as the final authority because a technically capable user can bypass the website and call Supabase directly using the public project configuration.

## 9.3 Identity versus trust

The architecture correctly avoids assuming that a valid Microsoft account is automatically trusted to publish.

This is particularly important if the Azure configuration accepts:

- Multiple tenants
- Personal Microsoft accounts
- All organizational accounts

Even if identity-provider scope is broad, the manual role table prevents an unknown account from becoming a contributor.

Institutionally, the Azure configuration should still be restricted to the appropriate tenant unless there is a documented reason for broader access.

---

## 10. Detailed Findings

Severity definitions used in this report:

- **Critical:** Could create immediate institutional exposure or invalidate a core security claim.
- **High:** Should be corrected before production use.
- **Medium:** Important for reliability, maintainability, or future scale.
- **Low:** Quality improvement or limited operational concern.

## Finding 1: Submission ownership is not bound to the authenticated contributor

**Severity:** High  
**Area:** Authorization and accountability

The application sends `submitted_by` from the browser. The insert policies verify only that the current account is an active contributor.

They do not verify:

```text
submitted_by == the signed-in contributor's user_roles.id
```

The `submitted_by` columns are also nullable.

### Why this matters

A contributor who bypasses the form and calls Supabase directly could:

- Use another contributor’s identifier
- Submit without a contributor identifier
- Create a misleading audit trail

### Required remediation

- Make `submitted_by` non-null.
- Add an RLS `WITH CHECK` expression tying the identifier to the authenticated email.
- Prefer a server submission action or database function that derives the contributor ID rather than accepting it from the client.

### Desired invariant

```sql
submitted_by in (
  select id
  from user_roles
  where email = auth.jwt() ->> 'email'
    and status = 'active'
)
```

---

## Finding 2: Own-submission read access is incomplete

**Severity:** Medium  
**Area:** Authorization consistency

The schema states that contributors can read their own pending and rejected submissions. An own-record policy exists for opportunities, but equivalent policies are missing for events and announcements.

### Impact

- Contributors receive inconsistent behavior.
- A future “My submissions” page would work only partially.
- The comments and implementation disagree.

### Remediation

Create equivalent contributor-own-record select policies for all three content tables.

---

## Finding 3: Live database failures silently return sample data

**Severity:** High  
**Area:** Reliability and data integrity

Several read functions return sample records when a configured Supabase query fails.

### Why this matters

In production, a database outage or policy error could display fake opportunities, fake deadlines, or fake announcements as though they were current college information.

This creates:

- Student confusion
- Reputational risk
- Hidden outages
- Incorrect operational conclusions
- Potential missed deadlines

### Remediation

- Use demo records only when an explicit demo-mode setting is active.
- Never use sample records as a production error fallback.
- Log the actual error.
- Display a user-appropriate service-unavailable message.
- Add monitoring and alerting.

---

## Finding 4: Demo mode is inferred from missing configuration

**Severity:** High  
**Area:** Deployment safety

If either Supabase public environment variable is missing, the application enters demo mode. Demo mode simulates an active administrator.

### Why this matters

A partially configured production deployment could appear functional while showing sample data and a simulated administrator experience.

### Remediation

Use an explicit setting:

```text
DEMO_MODE=true
```

Then enforce:

- Demo mode allowed in local development
- Demo mode optionally allowed in preview
- Demo mode prohibited in production
- Production startup failure when required variables are absent

---

## Finding 5: Original flyers are public before publication

**Severity:** High  
**Area:** Storage privacy and content security

The `flyers` bucket is public. Upload happens before the content record is submitted and approved.

### Risks

- Pending flyers are publicly retrievable by URL.
- Rejected flyers remain publicly retrievable.
- Abandoned form uploads may remain indefinitely.
- A flyer could contain personal contact information.
- Uploaded content is not visibly scanned.
- There is no documented retention policy.

### Remediation options

Preferred:

1. Store incoming flyers in a private bucket.
2. Use signed URLs in the review queue.
3. Publish or copy the asset only after approval.
4. Delete rejected or abandoned assets according to retention policy.

Alternative:

- Keep a private bucket permanently and generate signed URLs for authorized/public access through an application route.

---

## Finding 6: Upload validation is insufficient

**Severity:** High  
**Area:** File security

The browser input accepts images, but storage policy does not visibly enforce:

- Maximum file size
- Allowed MIME types
- Allowed extensions
- Image decoding
- Malware scanning
- Per-user quota

Client-side `accept="image/*"` is advisory and can be bypassed.

### Remediation

- Enforce size and MIME restrictions at the server or storage layer.
- Generate server-controlled filenames.
- Verify that uploaded bytes match the claimed file type.
- Reject active or executable formats.
- Define quota and cleanup jobs.
- Consider scanning uploaded files.

---

## Finding 7: Submission validation is primarily client-side

**Severity:** High  
**Area:** Data quality and security

HTML `required` fields provide a good user experience, but a direct API caller can bypass them.

The database guarantees some non-null values but does not comprehensively validate:

- Field length
- URL protocol
- Valid type list
- Major list membership
- Date reasonableness
- Organization authority
- Contact-domain policy
- Description size

### Remediation

Add a server-side submission action or route using a formal validation schema.

The database should also enforce core invariants with:

- Check constraints
- Non-null constraints
- Foreign keys
- Enumerated lookup tables where appropriate

---

## Finding 8: External links need protocol and content validation

**Severity:** Medium  
**Area:** Browser security and trust

Application and registration links are contributor-provided and rendered as clickable links.

### Risks

- Invalid URLs
- Unexpected protocols
- Misleading destinations
- Phishing links

### Remediation

- Accept only `https:` and, where justified, `http:`.
- Display destination hostname during review.
- Add an administrator warning for non-approved domains.
- Consider a link health check.
- Record when the link was last verified.

---

## Finding 9: The weekly digest is not idempotent

**Severity:** High  
**Area:** Email operations

The scheduled route sends whenever it is called and qualifying records exist. It does not create a digest-run record or use an idempotency key.

### Risks

- Duplicate email following retries
- Duplicate email following manual calls
- No durable record of delivery
- No ability to explain what was sent
- No protection against parallel execution

### Remediation

Create a `digest_runs` table containing:

- Digest week
- Status
- Started time
- Completed time
- Provider message ID
- Included content IDs
- Error
- Retry count

Use the week as a unique idempotency key.

---

## Finding 10: Cron authentication is optional

**Severity:** High  
**Area:** Abuse prevention

The weekly digest route validates a bearer secret only if `CRON_SECRET` is configured.

### Risk

An omitted production secret leaves the route publicly callable, potentially allowing email spam.

### Remediation

- Require the secret in production.
- Fail closed when it is absent.
- Rate-limit requests.
- Record every invocation.

---

## Finding 11: `emailed_this_week` is not maintained

**Severity:** Medium  
**Area:** Product correctness

Announcements support an `emailed_this_week` field and the interface displays it, but the digest route does not update it.

### Impact

The user interface can claim an announcement was emailed only if someone updates the database through another process.

### Remediation

Either:

- Maintain this field transactionally after confirmed delivery, or
- Replace it with a normalized digest-content history relationship.

The normalized history is preferable because “this week” is time-dependent and loses historical detail.

---

## Finding 12: Moderation lacks an audit trail

**Severity:** High  
**Area:** Governance

Approval and rejection mutate only the content status. The system does not record:

- Who reviewed the item
- When it was reviewed
- Why it was rejected
- What changed during review
- Whether the contributor resubmitted it
- When publication occurred

### Institutional significance

For a college-wide platform, leadership should be able to answer:

> Who approved this information, based on what source, and when?

The current system cannot fully answer that question.

### Remediation

Add an append-only `content_reviews` or `audit_events` table.

Suggested fields:

- Event ID
- Content type
- Content ID
- Actor user-role ID
- Action
- Previous status
- New status
- Reason
- Timestamp
- Structured metadata

---

## Finding 13: Administrators can update more than status at the database-policy level

**Severity:** Medium  
**Area:** Least privilege

The interface updates only status and verification, but the RLS policy broadly permits administrators to update table rows.

### Remediation

Use a controlled database function or server-side action for review decisions. Restrict direct table updates where practical.

---

## Finding 14: Major filtering produces different demo and live results

**Severity:** Medium  
**Area:** Product correctness

The demo filtering logic returns:

- Items explicitly tagged with the selected major
- Items tagged `All majors`

The live Supabase query checks only for the selected major.

### Impact

A live Computer Science student could miss an opportunity intended for all majors.

### Remediation

Use an `OR` condition:

```text
majors contains selected major
OR
majors contains All majors
```

Long term, normalize majors into lookup and relationship tables if reporting and personalization become important.

---

## Finding 15: Database and UI errors are often suppressed

**Severity:** Medium  
**Area:** Observability

Several operations return empty data or generic messages without structured logging.

### Impact

- Administrators cannot distinguish “nothing pending” from a failed query.
- Operators lack actionable diagnostics.
- Repeated failures may remain invisible.

### Remediation

- Add structured server logging.
- Add request and correlation IDs.
- Use an error-monitoring platform.
- Report operational failures separately from empty states.
- Add health checks.

---

## Finding 16: Storage upload failure is silently treated as no flyer

**Severity:** Medium  
**Area:** Data integrity

If flyer upload fails, the upload function returns `null`, and the structured content can still be submitted without explaining that the original source was lost.

### Remediation

- Return a typed upload error.
- Let the contributor retry.
- Require explicit confirmation to submit without the source flyer.
- Record whether a flyer was expected.

---

## Finding 17: Parser output has no durable provenance

**Severity:** Medium  
**Area:** Parsing governance

The parser returns raw text, fields, and detected flags, but the submitted database record does not preserve:

- OCR output
- Parser version
- Detected-field status
- Confidence
- Original versus contributor-edited values

### Why this matters

Without provenance, the college cannot evaluate:

- Parser accuracy
- Common failure patterns
- Whether incorrect content came from OCR, parsing, or manual editing
- Whether a future model improves performance

### Remediation

Store a parsing session record with appropriate retention controls.

---

## Finding 18: Parser “confidence” is a boolean pattern match

**Severity:** Medium  
**Area:** User trust

The `detected` object reports whether a pattern produced a value. It is not a calibrated confidence measure.

### Example

The first substantial line may be marked as a detected title even if it is a slogan, organization name, or call to action.

### Remediation

Use clearer terminology such as:

- Extracted
- Suggested
- Needs verification

If real confidence scores are introduced, calibrate them against labeled test data.

---

## Finding 19: Parser date logic is inherently ambiguous

**Severity:** Medium  
**Area:** Parsing accuracy

Current rules:

- Search for explicitly labeled deadlines.
- Collect all dates.
- Exclude the deadline.
- Use another date as the event date.
- If no deadline exists, a single date may be treated as a deadline.

### Failure cases

- Multi-day events
- Application open and close dates
- Recurring events
- Flyers with publication dates
- Missing years
- Year boundaries
- Multiple RSVP dates

### Remediation

- Support arrays or explicit date roles.
- Preserve the raw source span for every extracted value.
- Require confirmation for ambiguous date assignments.
- Build tests from real flyers.

---

## Finding 20: Pasted text and image OCR are not combined

**Severity:** Low to Medium  
**Area:** Parsing quality

If pasted text is present, the uploaded image is not passed into OCR for extraction. This prevents combining:

- Cleaner pasted email text
- Visual flyer context
- Information present only in the image

### Remediation

The future parser request should support multimodal evidence:

```text
typed/pasted text + image + source metadata
```

---

## Finding 21: No automated tests are present

**Severity:** High  
**Area:** Engineering quality

No test suite was found for:

- Parser extraction
- Authorization
- RLS behavior
- Submission validation
- Moderation
- Major filtering
- Email selection
- Digest idempotency
- Authentication callback behavior

### Remediation priorities

1. Parser unit tests
2. Validation tests
3. RLS integration tests
4. Admin-action tests
5. Digest selection and idempotency tests
6. End-to-end contributor and administrator workflows

---

## Finding 22: Build reproducibility has not been established

**Severity:** High  
**Area:** Release management

No package lockfile was present during the review. Dependency installation did not complete in the synced workspace, so a production build could not be verified.

### Risks

- Different installations may resolve different package versions.
- Production defects may not reproduce locally.
- Security review cannot identify an exact dependency graph.

### Remediation

- Generate and commit `package-lock.json`.
- Use `npm ci` in continuous integration.
- Run build, lint, tests, and security audit on every change.
- Deploy only immutable reviewed commits.

---

## 11. Flyer Parser Architecture

## 11.1 Current implementation

The parser has one primary entry point:

```javascript
parseFlyer({ text, imageFile, onProgress })
```

It returns:

```javascript
{
  rawText,
  source,
  fields: {
    title,
    date,
    time,
    deadline,
    location,
    contactName,
    contactEmail,
    link,
    presenterName,
    presenterAffiliation
  },
  detected: {
    title,
    date,
    time,
    deadline,
    location,
    contactName,
    contactEmail,
    link,
    presenterName,
    presenterAffiliation
  }
}
```

The parser has two conceptual layers:

1. OCR converts the image into text.
2. Field extraction converts text into structured suggestions.

The synchronous text-extraction function is separately exported, which makes it suitable for unit testing without invoking OCR.

## 11.2 Current extraction rules

The parser uses:

- Email regular expressions
- URL regular expressions
- Time regular expressions
- Written and numeric date expressions
- Location labels
- Room/building hints
- Deadline keywords
- Presenter keywords
- Line position for title inference

This is a pragmatic zero-cost prototype approach.

## 11.3 Human review is part of the parser design

The parser does not directly write database content. It fills an editable form.

This is important because the system treats parsing as assistance rather than truth.

The contributor:

- Sees extracted values
- Sees missing values
- Corrects values
- Confirms the contact
- Submits for administrative review

The administrator then performs a second human review before public publication.

---

## 12. Is Future API Integration Intentionally Preserved?

## 12.1 Verdict

**Yes, intentionally and visibly.**

Evidence in the implementation includes:

- One parser entry point
- A documented input/output contract
- The submit form imports the parser rather than implementing OCR rules itself
- The UI consumes canonical field names
- Parser results are mapped into a generic form
- Original flyers are retained
- The parser is asynchronous, which naturally supports remote calls

These are meaningful architectural choices, not accidental similarities.

## 12.2 What can remain unchanged

When an AI or external parsing API is introduced, these concepts can remain:

- The submit form
- Canonical field names
- Editable extracted values
- Missing-field indicators
- Human confirmation
- Administrative review
- Original source storage

## 12.3 What cannot safely remain unchanged

The current parser runs in a client component. A paid API key must not be placed there.

Therefore, the future implementation requires:

- A Next.js server route or server action
- Server-only provider credentials
- Request authorization
- Input-size limits
- File validation
- Timeout and retry controls
- Response-schema validation
- Logging and cost controls

The statement “only replace the body of `parseFlyer`” is directionally true from the form’s perspective, but incomplete from a security and deployment perspective.

## 12.4 Recommended future parser architecture

```text
Contributor browser
    |
    | authenticated request
    v
POST /api/parse-flyer
    |
    | validate identity, role, file, size, and request
    v
Parser orchestrator
    |
    +--> Local text/regex adapter
    |
    +--> OCR adapter
    |
    +--> Vision-model adapter
    |
    v
Canonical response validator
    |
    v
Structured suggestions + confidence + provenance
    |
    v
Editable contributor form
```

## 12.5 Recommended canonical parser result

```json
{
  "schemaVersion": "1.0",
  "parser": {
    "provider": "local-regex",
    "model": null,
    "version": "2026-07-26"
  },
  "source": {
    "type": "image",
    "fileId": "uuid",
    "ocrTextRetained": false
  },
  "fields": {
    "title": {
      "value": "Resume Workshop",
      "confidence": 0.91,
      "sourceText": "RESUME WORKSHOP",
      "needsReview": true
    },
    "date": {
      "value": "2026-07-29",
      "confidence": 0.84,
      "sourceText": "July 29, 2026",
      "needsReview": true
    }
  },
  "warnings": [],
  "processing": {
    "durationMs": 816,
    "estimatedCostUsd": 0
  }
}
```

## 12.6 Provider abstraction

Use a provider interface:

```javascript
async function parseWithProvider(input, context) {
  // Return the canonical parser result.
}
```

Possible providers:

- Local OCR plus regex
- Cloud document OCR
- Vision-capable language model
- University-managed AI service

The application should select a provider through server-side configuration, not form code.

## 12.7 Privacy requirements for external AI

Before uploading a flyer or text to an external model, the institution should determine:

- Whether the material contains student information
- Whether names and email addresses are personal information
- Whether the vendor retains prompts or images
- Whether the vendor uses submissions for training
- Where processing occurs
- How deletion requests work
- Whether institutional procurement approval is required
- Whether a data-processing agreement is required
- Whether FERPA could apply to future document types

The current browser-side OCR avoids many of these external-processing questions.

---

## 13. Scalability Assessment

## 13.1 Likely early-stage capacity

The current architecture should support a modest college pilot because:

- Content volume is small.
- Public reads are simple.
- Supabase handles database concurrency.
- Vercel handles server execution.
- OCR runs in the contributor’s browser.
- Moderation volume is likely manageable.

## 13.2 Scaling limitations

As adoption increases, the following will become important:

- Pagination
- Search
- Database indexes
- Normalized majors and organizations
- Duplicate detection
- Bulk administration
- Content ownership transfer
- Contributor lifecycle management
- Audit history
- Email subscription preferences
- Bounce and complaint handling
- Caching and revalidation strategy
- Rate limiting
- File quotas
- Accessibility testing

## 13.3 Index recommendations

Likely useful indexes include:

- Opportunity status and deadline
- Event status and date
- Announcement status and creation time
- Content submitter
- User-role email
- Review status and creation time

The unique constraint on `user_roles.email` already provides an index, but email normalization should be considered.

---

## 14. Accessibility and User Experience

The interface includes several positive elements:

- Semantic buttons and links
- Required-field indicators
- Form input labels
- Major filter label
- Calendar navigation labels
- Visible moderation state
- Contact disclosure confirmation
- Original-source access

Areas needing formal review:

- Keyboard-only navigation
- Focus order
- Focus visibility across all controls
- Screen-reader calendar behavior
- Form error announcement
- Color contrast
- Meaning conveyed by color alone
- Mobile calendar usability
- Image alternative text
- OCR progress announcements
- Reduced-motion support
- Date and time localization

The monthly calendar grid in particular should be tested with screen readers. A list view is already available and may serve as the more accessible representation, but it should be clearly exposed.

---

## 15. Privacy and Records Governance

The platform publishes contact details and stores uploaded flyers.

Leadership should define:

- Which contact details may be public
- Whether personal student email addresses are acceptable
- Whether organization mailboxes are preferred
- How long rejected submissions are retained
- How long original flyers are retained
- Who may retrieve pending flyers
- How users request corrections
- How users request removal
- Whether archived opportunities remain retrievable
- Whether audit records are retained longer than content

The interface’s contact-confirmation step is a good product control, but it is not a substitute for a published privacy and records policy.

---

## 16. Reliability and Operations

## 16.1 Required production monitoring

At minimum, monitor:

- Website availability
- Authentication callback failures
- Supabase query errors
- Submission failures
- Storage upload failures
- Pending review count
- Digest execution
- Resend response status
- Digest duplicate prevention
- Database archive job execution
- Elevated error rates

## 16.2 Required operational dashboards

Useful measures:

- Published items by type
- Pending review age
- Average review time
- Rejection rate and reasons
- Submission volume by organization
- Parser completion rate
- Parser correction rate
- Email send, delivery, bounce, and complaint rate
- Link failure rate
- Expired content count

## 16.3 Backup and recovery

Before production, document:

- Supabase backup configuration
- Point-in-time recovery availability
- Restoration procedure
- Storage recovery expectations
- Recovery time objective
- Recovery point objective
- Responsible owner
- Test schedule

## 16.4 Incident response

Define responses for:

- Incorrect deadline publication
- Compromised contributor account
- Malicious link
- Inappropriate flyer
- Accidental personal-information disclosure
- Duplicate college-wide email
- Authentication outage
- Database outage

---

## 17. Governance and Operating Model

Technology alone does not define who may publish college communications.

The college should designate:

- Platform owner
- Technical owner
- Content-policy owner
- Contributor approver
- Review administrators
- Security contact
- Privacy contact
- Email sender-domain owner
- Incident-response owner

Recommended governance rules:

- Require organization-level contributor sponsorship.
- Review contributor access each semester.
- Remove access when leadership roles change.
- Require administrator multi-factor authentication through the identity provider.
- Define review service-level expectations.
- Use rejection reasons.
- Require source verification for deadlines and application links.
- Define emergency correction procedures.

---

## 18. Dean of Engineering Question-and-Answer Brief

## What exactly is this platform?

It is a moderated college communications hub that converts opportunities, events, announcements, flyers, and email text into structured information students can browse in one place.

## What problem does it solve?

It reduces fragmented communications, missed deadlines, duplicate calendars, and dependence on students seeing the correct email or flyer at the correct time.

## Is it a social network?

No. It is currently a curated publishing and discovery platform. Student profiles, personalized feeds, and sponsor portals are explicitly outside the present scope.

## Who may view the platform?

Published content is publicly readable under the current design.

## Who may submit?

A Microsoft-authenticated user whose email appears in the application’s role table with active status.

## Does every PVAMU student automatically receive posting permission?

No. Authentication proves identity; manually approved contributor status grants submission access.

## Who may publish?

Only an active administrator can approve pending content for publication.

## Does the database enforce that?

Yes, publication updates are protected by database Row Level Security in addition to application checks.

## Is every part of authorization currently correct?

No. Contributor submission ownership must be tightened so a direct API caller cannot attribute a submission to another contributor or omit attribution.

## Is AI being used today?

Not as a remote generative-AI service. Tesseract performs browser-side OCR, and local rules extract possible fields.

## Does the system automatically trust parsed information?

No. The contributor edits and confirms extracted values, and an administrator reviews the submission before publication.

## Is a future AI integration planned in the code?

Yes. The parser is deliberately isolated behind one asynchronous structured interface. A future server-side model adapter can return the same canonical fields.

## Can the team simply paste an AI key into the current parser?

No. The current parser runs in the browser. A paid or private API key must remain on the server. The platform needs a protected server parsing endpoint.

## Will a future AI integration send information outside the university?

Possibly, depending on the provider. That requires privacy, procurement, retention, and data-processing review before deployment.

## Are original flyers retained?

Yes. They are uploaded to Supabase Storage and linked from published records.

## Are those flyers private during review?

No. The current bucket is public, which should be corrected before institutional production use.

## Can students trust every listing?

The system intends every published listing to have passed administrator review. However, the college must define what “verified” means and establish source-verification procedures.

## Can the college prove who approved an item?

Not yet. The current system changes status but does not store a durable reviewer and decision history.

## What happens when the database is unavailable?

Some list pages currently return sample data, which is inappropriate for production and must be replaced with honest outage behavior.

## How are weekly emails protected?

The route can check a shared bearer secret, but the secret is optional in the current code. Production must require it.

## Can a weekly digest be sent twice?

Yes. The current process does not have idempotency or a durable digest-run record.

## Is the platform scalable?

The selected technologies can scale beyond a college pilot. The current application logic requires pagination, indexing, normalized metadata, monitoring, audit trails, and operational controls as adoption increases.

## Is the platform secure?

It has a good security foundation—managed identity, active contributor roles, Row Level Security, and moderation—but it has several correctable gaps that prevent a full production-security endorsement today.

## Is it ready to launch?

It is suitable for demonstration. It could support a limited controlled pilot after the high-priority security corrections. It should not yet be treated as an authoritative production college service.

## Does it require a complete rewrite?

No. The current architecture can be hardened incrementally.

## What is the greatest strength?

The strongest feature is the controlled information pipeline: source material becomes editable structured data, receives human review, and is published through a shared system.

## What is the greatest concern?

The greatest concern is that several institutional assurances—accurate submitter identity, private pending flyers, reliable live data, and auditable approval—are intended but not yet fully enforced.

---

## 19. Recommended Remediation Roadmap

## Phase 0: Immediate safety corrections

Complete before any external pilot:

1. Bind `submitted_by` to the authenticated contributor.
2. Make submitter references non-null.
3. Add own-submission read policies for events and announcements.
4. Replace inferred demo mode with an explicit development-only flag.
5. Remove sample-data fallback from live query failures.
6. Require `CRON_SECRET` in production.
7. Correct live major filtering.
8. Commit a dependency lockfile.
9. Establish a passing production build.

## Phase 1: Controlled pilot readiness

1. Move flyers to private or approval-aware storage.
2. Add server-side submission validation.
3. Add upload size and type validation.
4. Add structured error monitoring.
5. Create review-history records.
6. Add rejection reasons.
7. Add parser unit tests.
8. Add RLS integration tests.
9. Add contributor and administrator end-to-end tests.
10. Create documented backup and incident procedures.

## Phase 2: Institutional production readiness

1. Add digest idempotency and delivery history.
2. Add contributor lifecycle administration.
3. Add content correction and withdrawal workflows.
4. Add accessibility testing and remediation.
5. Add privacy and retention policies.
6. Add link validation.
7. Add pagination and search.
8. Add database indexes.
9. Add operational dashboards.
10. Add formal release and change-management procedures.

## Phase 3: API and intelligent parsing

1. Define a versioned canonical parsing schema.
2. Add a protected server parsing endpoint.
3. Implement provider adapters.
4. Preserve field-level provenance and confidence.
5. Create a real-flyer evaluation set.
6. Establish baseline parser accuracy.
7. Complete privacy and vendor review.
8. Add cost limits, timeouts, retries, and fallback.
9. Measure contributor correction rates.
10. Enable the new parser gradually behind a feature flag.

## Phase 4: Platform expansion

Only after governance and operational maturity:

- Student profiles
- Personalized feeds
- Notification preferences
- Sponsor portal
- External calendar integrations
- Public or partner APIs
- Analytics for departments and organizations
- Automated duplicate detection
- Recommendation systems

---

## 20. Recommended Test Strategy

## 20.1 Parser unit tests

Create fixtures for:

- Event flyer with one date
- Opportunity flyer with one deadline
- Flyer containing date and deadline
- Multiple emails
- Multiple URLs
- Missing year
- Multi-day event
- OCR spelling errors
- Presenter and organizer on separate lines
- No location
- Non-PVAMU contact
- Empty input

Every test should verify:

- Returned fields
- Detected flags
- Ambiguity behavior
- No false assignment when evidence is weak

## 20.2 Database security tests

Verify:

- Anonymous users read published rows only.
- Anonymous users cannot insert.
- Unverified authenticated users cannot insert.
- Active contributors can insert.
- Contributors cannot impersonate another submitter.
- Contributors can read their own pending records.
- Contributors cannot read another contributor’s pending records.
- Contributors cannot publish.
- Administrators can read and review pending content.
- Public users cannot retrieve private pending flyers.

## 20.3 Application tests

Verify:

- Microsoft callback success and failure
- Contributor gating
- Administrator gating
- Required-field validation
- Contact confirmation
- Upload error handling
- Parser error handling
- Approval and rejection
- Correct publication visibility
- Major filter behavior
- Calendar behavior
- Digest item selection

## 20.4 Operational tests

Verify:

- Database outage behavior
- Email provider outage behavior
- Digest retry behavior
- Duplicate cron request behavior
- Expired opportunity archival
- Backup restoration
- Compromised contributor deactivation

---

## 21. Proposed Production Architecture

```text
Students and public visitors
             |
             v
       Next.js website
             |
             +--------------------------+
             |                          |
             v                          v
      Published content          Microsoft sign-in
             |                          |
             v                          v
      Supabase PostgreSQL        Supabase Auth
      with Row Level Security           |
                                        v
                                  user_roles
                                        |
                                        v
                               Contributor submission
                                        |
                       +----------------+----------------+
                       |                                 |
                       v                                 v
              Private flyer storage            Server parser endpoint
                                                         |
                                             +-----------+-----------+
                                             |                       |
                                             v                       v
                                      Local parser             Approved AI API
                                             |                       |
                                             +-----------+-----------+
                                                         |
                                                         v
                                                Editable structured data
                                                         |
                                                         v
                                                Administrative review
                                                         |
                                                         v
                                         Publication + audit event + asset access
                                                         |
                                         +---------------+---------------+
                                         |                               |
                                         v                               v
                                  Public website                  Weekly digest
```

---

## 22. Suggested Ownership Matrix

| Responsibility | Recommended owner |
|---|---|
| Platform sponsorship | Dean’s office or delegated college leadership |
| Product direction | C.O.D.E. program leadership |
| Technical ownership | Designated engineering/IT team |
| Supabase ownership | Technical owner with institutional backup administrator |
| Azure application | University identity/IT authority |
| Contributor approval | C.O.D.E. leadership or departmental delegates |
| Content moderation | Named trained administrators |
| Privacy policy | University privacy/legal authority |
| Security review | University information security |
| Email domain | Authorized college or university communications owner |
| Incident response | Joint technical and communications owners |
| Accessibility | Institutional accessibility owner plus technical team |

---

## 23. Acceptance Criteria for a Production Decision

The platform should not be labeled production-ready until all of the following are true:

- A clean dependency installation succeeds from a committed lockfile.
- Production build succeeds in continuous integration.
- Automated tests pass.
- Submission ownership is enforced at the database level.
- Demo mode cannot activate accidentally in production.
- Live errors never show demo records.
- Pending and rejected flyers are not publicly exposed.
- Server-side validation protects all writes.
- Cron authentication is mandatory.
- Digest sending is idempotent.
- Review decisions identify the reviewer and timestamp.
- Monitoring and alerting are operational.
- Backup restoration has been tested.
- Accessibility review is complete.
- Privacy and retention policies are approved.
- Named operational owners are assigned.
- Incident procedures are documented.

---

## 24. Final Assessment

The C.O.D.E. Engineering Hub demonstrates good product instincts and a credible architectural foundation.

The design intentionally creates a controlled pipeline:

```text
Identity
  → verified contributor
  → assisted structured submission
  → human moderation
  → public publication
  → calendar and digest distribution
```

That pipeline is appropriate for an engineering college because it balances participation with institutional control.

The parser architecture also intentionally preserves a future API integration. The stable `parseFlyer()` contract, canonical field mapping, asynchronous execution, editable values, and original-source retention all support a future transition from local OCR and rules to a server-hosted vision or language-model provider.

The future integration is not literally a one-line provider replacement because private API credentials cannot safely run in the browser. A protected server parsing layer must be added. Nevertheless, the current consumer-facing abstraction means the submit experience and core data model can survive that transition.

The central engineering judgment is:

> This is not a throwaway mockup. It is a real prototype with deliberate architectural choices. It is also not yet a production institutional system because several security, auditability, privacy, validation, and reliability promises are present in intent but incomplete in enforcement.

The correct next step is not a rewrite. It is a disciplined hardening program, beginning with ownership enforcement, explicit demo configuration, private source storage, server-side validation, reliable digest operations, audit history, testing, and monitoring.

Once those items are complete, the platform can become a defensible shared communications service and a foundation for future API-based parsing, personalized discovery, external integrations, and college-level analytics.

---

## Appendix A: Key Source Files

| Responsibility | File |
|---|---|
| Authentication and viewer roles | `lib/auth.js` |
| Browser Supabase client and demo detection | `lib/supabaseClient.js` |
| Server Supabase client | `lib/supabaseServerClient.js` |
| Public data access and submission | `lib/data.js` |
| Administrative review data | `lib/adminData.js` |
| Flyer OCR and parsing | `lib/flyerParser.js` |
| Flyer upload | `lib/storage.js` |
| Submission interface | `components/SubmitForm.js` |
| Contributor access page | `app/submit/page.js` |
| Administrative server actions | `app/admin/review/actions.js` |
| Administrative review page | `app/admin/review/page.js` |
| Digest route | `app/api/cron/weekly-digest/route.js` |
| Database and RLS policies | `supabase/schema.sql` |
| Session-refresh middleware | `middleware.js` |
| Vercel schedule | `vercel.json` |
| Deployment instructions | `README.md` |

---

## Appendix B: Review Limitations

This assessment was based on the source files present in the workspace.

The review did not include:

- A connected production Supabase project
- Inspection of real Azure tenant configuration
- Real Vercel settings
- Real Resend settings or delivery logs
- Live penetration testing
- Real contributor accounts
- Real institutional flyers
- Formal accessibility testing
- Formal privacy or legal review
- Production traffic testing

Dependency installation did not complete in the synced workspace during the audit. No dependency lockfile or automated test suite was present. Therefore, this report does not claim that the current repository produces a successful production build.

These limitations do not change the code-level findings, but deployment-specific conclusions should be confirmed against the real environments before launch.
