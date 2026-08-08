# C.O.D.E. Engineering Hub

## Product Requirements and Architecture Addendum

**Purpose:** Preserve the original senior engineering audit while formally incorporating subsequent product decisions and clarifications.  
**Relationship to the original report:** This document supplements, but does not replace, `C.O.D.E._Engineering_Hub_Senior_Engineering_Audit.md`.

---

## 1. Confirmed Product Direction

The platform should be plentiful but organized. Students should be able to discover a large number of opportunities, events, partnerships, and announcements without facing an unstructured wall of content.

This requires the platform to collect rich, normalized information before it attempts to provide advanced filters. A filter cannot work reliably when the underlying value was never collected or was entered inconsistently.

The following are now explicit product requirements:

- Rich but progressively disclosed filtering
- Screenshot and flyer extraction that suggests identifiers and tags
- Recruiter submission through secure one-time links
- Organization-partnership request and confirmation workflows
- Multi-level review routing
- Student email alerts without requiring a conventional account
- Understandable flyer validation across varied sizes and formats
- Safe link-health checking
- Complete archive, withdrawal, deletion, and retention behavior
- Docker-based deployment support
- A future AI parsing path that retains the existing form contract
- Discreet but unmistakable disclosure and affirmative acceptance before external AI processing
- Consistent contributor behavior across opportunities, events, and announcements

---

## 2. Finding 10 Explained: Optional Cron Authentication

### 2.1 What a cron route is

The platform contains a web address:

```text
/api/cron/weekly-digest
```

Vercel is scheduled to visit that address every Monday. When it is visited, the application gathers current opportunities, events, and announcements and asks Resend to send the weekly email.

Although the route is intended for a scheduler, it is still an internet-accessible web endpoint.

### 2.2 What the secret is supposed to do

`CRON_SECRET` is a private shared value known by the application and the trusted scheduler.

The scheduler sends:

```text
Authorization: Bearer <CRON_SECRET>
```

The application compares that value with its configured secret. If they do not match, it should refuse to send email.

### 2.3 What is wrong in the current implementation

The current logic checks the request only when `CRON_SECRET` exists.

In plain language:

```text
If a secret was configured:
    require the correct secret

If no secret was configured:
    allow the request anyway
```

This is called **failing open**.

If an administrator forgets to configure the production secret, anyone who discovers or guesses the route could invoke it. Because the route sends a real email when qualifying content exists, repeated requests could generate duplicate college-wide messages.

### 2.4 What the behavior should be

Production should fail closed:

```text
If production secret is missing:
    refuse to send and raise an operational alert

If authorization header is missing:
    return 401 Unauthorized

If authorization header is wrong:
    return 401 Unauthorized

If authorization is correct:
    continue
```

### 2.5 Why authentication alone is not sufficient

Even a correctly protected route may be called twice because:

- The scheduler retries after a timeout.
- A network response is lost after Resend accepted the email.
- Two application instances receive the request.
- An administrator manually retries.

The route therefore needs idempotency in addition to authentication.

The platform should create one digest-run record per scheduled week. A uniqueness rule should prevent a second successful send for that week unless an authorized administrator deliberately creates a replacement edition.

Recommended states:

- `scheduled`
- `building`
- `sending`
- `sent`
- `failed`
- `cancelled`
- `superseded`

Recommended recorded information:

- Week or edition ID
- Included content IDs
- Trigger source
- Start and completion times
- Resend message ID
- Failure details
- Retry count
- Actor, for manual sends

### 2.6 Effect on administrators

This change does not meaningfully restrict normal administrators.

It prevents direct casual invocation of a powerful email operation. A manual “Send digest” action should be a separate authenticated administrative action with:

- Preview
- Recipient summary
- Confirmation
- Idempotency warning
- Audit event

---

## 3. Finding 12 Confirmed: Moderation Audit History Is Required

The platform must be able to answer:

- Who submitted this?
- Who reviewed it?
- Who edited it?
- Who approved it?
- Who rejected it?
- Why was it rejected?
- Who withdrew or archived it?
- Who restored it?
- What was sent in an email?
- What changed between versions?

Changing only the current `status` value is insufficient because it destroys the previous state.

### 3.1 Recommended audit design

Use an append-only audit-event table.

Suggested fields:

```text
id
content_type
content_id
actor_type
actor_id
action
previous_status
new_status
reason
changes
created_at
request_id
```

Suggested actions:

- `submitted`
- `parser_suggested`
- `contributor_corrected`
- `partnership_requested`
- `partnership_accepted`
- `partnership_declined`
- `review_started`
- `changes_requested`
- `approved`
- `rejected`
- `published`
- `withdrawn`
- `archived`
- `restored`
- `soft_deleted`
- `permanently_deleted`
- `digest_included`

### 3.2 Administrative experience

The audit requirement should not turn every action into a burdensome form.

- Approval may remain one click when no unusual condition exists.
- Rejection, withdrawal, and permanent deletion should require a reason.
- Material edits should display a before-and-after comparison.
- The timeline should be readable from the content record.
- Routine machine events should be collapsible.

---

## 4. Reducing the Impact of Section 12.3

The original report stated that an external AI provider cannot safely be inserted directly into the existing browser parser because private API credentials must not be shipped to users.

That remains true, but the architectural impact can be kept small.

### 4.1 What remains intact

The current form may continue calling one conceptual parser:

```javascript
parseFlyer(input)
```

The form may continue receiving:

```text
rawText
source
fields
detected or confidence metadata
```

The contributor experience, canonical fields, editable form, and administrative review do not need to be rewritten.

### 4.2 Thin adapter architecture

Use this internal structure:

```text
parseFlyer(input)
    |
    +-- Local mode
    |     Browser OCR + local rules
    |
    +-- Assisted AI mode
          Protected server endpoint
              → provider adapter
              → validated canonical response
```

From the form’s perspective, both modes return the same shape.

### 4.3 Why a server endpoint is still required

It protects:

- Provider API keys
- University configuration
- Usage limits
- Prompt templates
- Provider selection
- Cost controls
- Audit logs

It also enables:

- Rate limiting
- File validation
- Timeout and retry handling
- Response-schema validation
- Provider replacement without shipping new secrets to browsers

### 4.4 How to keep the server boundary small

Create one provider-neutral endpoint:

```text
POST /api/parser
```

The endpoint accepts a versioned request and returns a versioned canonical response. Provider-specific code stays behind an adapter interface.

The local parser remains available as:

- Default mode
- Privacy-preserving option
- Failure fallback
- Zero-cost development option

### 4.5 Recommended mode strategy

```text
Local only
    No external AI processing

AI assisted
    External provider used only after disclosure and acceptance

Manual
    No automatic extraction
```

This makes AI an enhancement rather than a mandatory dependency.

---

## 5. AI Disclosure, Acceptance, and Consent

Before a user’s screenshot, flyer, pasted text, contact information, or other submission material is sent to an external AI provider, the platform must provide disclosure and obtain affirmative acceptance.

The disclosure should be discreet enough not to overwhelm the submission experience, but unmistakable enough that a reasonable user knows external processing will occur.

### 5.1 Required disclosure content

The user should be told:

- That AI-assisted extraction is optional
- What content will be processed
- Whether processing occurs through an external provider
- The purpose of processing
- That extracted values may be wrong
- That the user must verify the result
- Whether the provider retains content
- Where the applicable privacy notice can be read
- That choosing local/manual mode avoids external AI processing

### 5.2 Recommended interface

When AI mode is first selected:

```text
AI-assisted extraction

To suggest fields and tags, the flyer or text you provide will be
processed by an approved external AI service. Do not upload confidential
student records or information you are not authorized to share. AI
suggestions may be incorrect and must be reviewed before submission.

[ ] I understand and agree to this processing.

[Use AI-assisted extraction]
[Use private local extraction instead]
```

The checkbox must not be preselected.

### 5.3 Consent record

Record:

- User or invitation identity
- Consent notice version
- Accepted processing mode
- Timestamp
- Parser provider category
- Submission or parsing-session ID

Do not rely only on a cookie saying the user clicked “accept.”

### 5.4 Returning users

Do not show a large modal on every use if the notice has not changed. Use:

- A persistent “AI-assisted” label beside the action
- A link to “How your file is processed”
- Reacceptance when the notice, provider category, or data use materially changes

### 5.5 Recruiter invitations

External recruiters using one-time links must receive the same disclosure. Acceptance of the invitation terms is not automatically consent to external AI processing; those should be separately understandable.

---

## 6. Rich Taxonomy and Student Filtering

The platform should collect enough structured information to support useful student discovery.

### 6.1 Core structured dimensions

- Source platform
- External posting or requisition ID
- Employer
- Partner organization
- Opportunity category
- Employment type
- Paid or funded status
- Compensation or award
- Work mode
- City, state, country, and region
- Eligible majors
- Academic classifications
- Required and preferred skills
- Industry
- GPA requirement
- Work-authorization and sponsorship requirements
- Opening date
- Deadline, time, and time zone
- Expected start term
- Duration
- Alumni connection
- Corporate sponsor relationship
- Verified source

### 6.2 Classification layers

- Controlled institutional values
- Free-form emerging tags
- Parser-suggested tags
- Human-confirmed tags
- System-derived labels
- Administrative labels

### 6.3 Student interface

Default filters:

- Search
- Major
- Category
- Deadline/date
- Paid/funded
- Work mode
- Location
- Academic classification

Expanded filters:

- Employer
- Industry
- Skills
- GPA
- Work authorization
- Source
- Verified/featured

Use removable chips, result counts, URL-preserved state, clear reset, and progressive disclosure.

---

## 7. Screenshot and Flyer Extraction

The parser should eventually suggest:

- Standard fields
- Content classification
- Employer
- Source platform
- Visible posting identifier
- Majors
- Skills
- Work mode
- Academic level
- Compensation
- GPA
- Sponsorship requirements
- Alumni or sponsor relationship

Automatically inferred values remain suggestions until confirmed.

OCR cannot recover a hidden link behind an image button. The contributor must provide the actual URL unless it is visibly printed, encoded in a QR code, or retrieved through an approved integration.

---

## 8. Flyer Acceptance and Clear Validation

Flyers arrive in many sizes and shapes. Do not impose a single required width, height, or aspect ratio.

Accept common safe formats, including:

- JPEG
- PNG
- WebP
- PDF, after PDF support is implemented and validated

Validate:

- Actual file type
- Total bytes
- Total decoded pixels
- PDF page count
- Processing time
- Corruption
- Active or unsafe content

Normalize oversized images internally for OCR while retaining an approved source version where policy permits.

Every rejection must explain:

- What was wrong
- The permitted limit or format
- How to correct it
- That pasted text remains an alternative

Example:

> This file is 42 MB and is too large to process safely. Please upload a version under 15 MB, take a screenshot, or paste the posting text.

---

## 9. Recruiter One-Time Submission Links

An authorized administrator or organization leader may issue an external submission invitation.

Required properties:

- Cryptographically random token
- Hashed token at rest
- 24-hour default expiration
- Single use
- Revocable
- Invited email binding
- Company and optional partner-organization context
- One draft/submission scope
- No access to other platform records
- Pending status after submission
- Full issuance and use audit events

Recruiters do not receive administrative access.

---

## 10. Organization Partnership Requests

When a recruiter identifies a partner organization:

1. The platform checks for an existing confirmed relationship.
2. If absent, the organization leader receives a request.
3. The leader accepts, declines, or requests more information.
4. The system records the response.
5. No partnership is publicly claimed until confirmed.

If the organization profile is incomplete, the leader may be asked to provide:

- Official name
- General email
- Leader contacts
- Faculty adviser
- Description
- Majors served
- Website/social links
- Authorized reviewers

---

## 11. Review Routing

Suggested paths:

```text
Recruiter
  → Partner organization reviewer
  → C.O.D.E. reviewer
  → Publication
```

Without a partner organization:

```text
Recruiter
  → C.O.D.E. reviewer
  → Publication
```

Higher-risk or special content may require a college administrator.

Reviewer levels should be explicit roles, not an undefined “higher-up” relationship.

---

## 12. Student Alerts Without Conventional Accounts

Students may subscribe by verified email using double opt-in.

Preferences may include:

- Majors
- Opportunity categories
- Skills
- Employers
- Paid/funded only
- Work mode
- Scholarships
- Events
- Deadline reminders
- Delivery frequency

Use time-limited magic links for preference management. Every message requires unsubscribe and a reason the recipient received it.

---

## 13. Link Health Checks

Check:

- Valid HTTP/HTTPS protocol
- Response status
- Redirect destination
- Redirect count
- Timeout
- Domain
- Previously healthy versus newly failing state

Use results:

- Healthy
- Redirected
- Login required
- Temporarily unavailable
- Broken
- Expired
- Unable to verify

Authenticated Handshake and LinkedIn pages must not be considered broken merely because an anonymous check reaches a login screen.

The checker must defend against server-side request forgery by blocking:

- Private IP addresses
- Loopback
- Link-local addresses
- Cloud metadata addresses
- Internal hostnames
- Unsafe redirects

Link health should normally produce a review warning rather than automatically reject a posting.

---

## 14. Deletion and Retention

Distinguish:

- Withdraw
- Archive
- Reject
- Soft delete
- Permanent deletion

Contributors may withdraw their pending submissions and request corrections. They may not erase institutional review history.

Administrators may archive, withdraw, restore, and deliberately permanently delete. Destructive actions require a reason and preview of associated files.

Recommended fields:

```text
archived_at
archived_by
withdrawn_at
withdrawn_by
deleted_at
deleted_by
deletion_reason
```

Files must be linked to an upload session or content record. Abandoned uploads should expire. Permanent deletion should remove associated storage objects and create an audit event.

---

## 15. Effect of Security Corrections on Users

| Correction | Practical effect |
|---|---|
| Bind submitter to authenticated identity | Invisible to normal users |
| Complete own-submission policies | Gives contributors consistent access |
| Explicit demo mode | No ordinary-user friction |
| Honest outage behavior | Replaces misleading demo data with a clear outage message |
| Private pending flyers | Reviewers use secure URLs |
| Server-side validation | Clearer actionable form errors |
| File validation | Only unsafe, corrupt, or excessive files are blocked |
| Audit history | Reasons required for rejection, withdrawal, or deletion |
| Digest protection | No normal-user impact |
| Controlled admin actions | Administrators use explicit actions rather than unrestricted updates |
| Link checks | Usually warnings, not automatic blocks |

The goal is targeted control with understandable feedback, not broad restriction.

---

## 16. Docker Deployment Requirement

The repository now includes Docker scaffolding:

- `Dockerfile.production`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `.dockerignore`
- `package-lock.json`

The Compose override selects `Dockerfile.production`.

Run:

```bash
docker compose up --build
```

The container:

- Builds with a locked npm dependency graph
- Runs as a non-root user
- Exposes port 3000
- Uses production mode
- Includes a health check
- Accepts `.env.local` when present
- Restarts unless deliberately stopped

Secrets must be supplied at runtime and must never be built into the image.

The dependency audit currently reports two high-severity findings. They require investigation and controlled upgrades; `npm audit fix --force` should not be used without compatibility testing.

---

## 17. Updated Implementation Order

### Immediate foundation

1. Correct ownership and all inconsistent RLS behavior.
2. Make demo mode explicit.
3. Remove live fallback to sample content.
4. Require cron authentication and digest idempotency.
5. Implement the audit-event model.
6. Make pending flyers private.
7. Add server validation and understandable upload errors.
8. Establish reproducible Docker and CI builds.
9. Investigate dependency vulnerabilities.

### Discovery foundation

1. Define the canonical taxonomy.
2. Normalize organizations, employers, majors, skills, and classifications.
3. Expand screenshot tag suggestions.
4. Build progressive filters.
5. Measure filter usage and zero-result searches.

### External participation

1. Add recruiter invitation tokens.
2. Add partnership requests.
3. Add organization profiles and reviewers.
4. Add review routing.
5. Add automated email history.

### Student engagement

1. Add double-opt-in email subscriptions.
2. Add preference magic links.
3. Add deadline alerts and digest preferences.

### AI-assisted processing

1. Preserve local OCR.
2. Add the provider-neutral server adapter.
3. Add versioned schemas.
4. Add explicit AI disclosure and consent.
5. Add provider/privacy review.
6. Add provenance, confidence, limits, fallback, and cost monitoring.

---

## 18. Updated Product Principle

The platform should follow this rule:

> Collect richly, normalize carefully, disclose processing honestly, review consequential information with humans, and present complexity progressively.

This direction preserves the original architecture while expanding it into a controlled platform for students, organizations, recruiters, sponsors, administrators, and future AI-assisted extraction.
