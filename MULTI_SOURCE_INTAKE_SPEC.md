# Panther Hub Multi-Source Intake Specification

**Status:** Product decisions approved for pilot implementation  
**Purpose:** Define how Panther Hub collects, interprets, merges, labels, and reviews flyers, PDFs, screenshots, email text, and manually entered information.

---

## 1. Core principle

Panther Hub should make submission faster without confusing these distinct roles:

- The person entering the submission
- The person or organization that referred or shared it
- The organization that owns the opportunity
- The official program contact
- The Panther Hub reviewer

Every parsed value is a suggestion until a human confirms it. No source or parser may publish automatically.

---

## 2. First submission question: relationship to the source

Before files or text are added, ask:

> How did this opportunity reach Panther Hub?

Options:

1. I am the original program or opportunity contact.
2. I am submitting on behalf of a PVAMU department, faculty member, or staff member.
3. I am submitting on behalf of a registered student organization.
4. This was referred by a sponsor or corporate partner.
5. This was referred by a PVAMU alumnus or alumna.
6. I discovered it through an external source such as LinkedIn, Handshake, or an employer website.
7. Other - explain briefly.

Then ask only the relevant follow-up questions.

Examples:

- Who referred or shared it?
- What is that person's title or relationship to PVAMU?
- What department or organization are they associated with?
- What email address did it come from?
- Is the referrer also the official program contact?
- Should the referrer's contact information be shown publicly?

Do not assume that the authenticated submitter is the source, referrer, or public contact.

---

## 3. Required identity distinctions

Store these separately:

### Submitter

The authenticated contributor entering the content into Panther Hub. Derived on the server and never trusted from browser input.

### Referral source

The person, department, organization, sponsor, alumnus, or external channel through which Panther Hub received the information.

### Opportunity owner

The organization operating the program, employment opportunity, scholarship, event, or competition.

### Program contact

The person or organization students should contact with program questions.

### Public contact

The contact approved for display to students. This may differ from the referral source and program owner.

### Reviewer

The authorized Panther Hub or College reviewer responsible for the publication decision.

---

## 4. Source intake flow

```text
Identify relationship to source
        ↓
Add one or more sources
        ↓
Process every source independently
        ↓
Merge suggested fields using source-role rules
        ↓
Show warnings, missing information, and conflicts
        ↓
Contributor confirms or corrects
        ↓
Preview student-facing post
        ↓
Submit for human review
```

The Add source control should offer:

- Upload flyer or PDF
- Upload screenshot or email screenshot
- Paste email or posting text
- Add application or source link
- Enter details manually

Recommended helper text:

> A flyer or PDF is recommended for program details, eligibility, and deadlines. An email or post screenshot helps Panther Hub understand the intended audience, referral source, and local context. You may provide either or both.

---

## 5. Source precedence rules

Precedence applies by field category, not by blindly selecting one entire document.

### Flyer or official program PDF leads for

- Program title
- Program description
- Official eligibility
- Compensation
- Duration
- Cohort dates
- Application deadline
- Application URL
- Program owner
- Program contact

### Email or initial-post screenshot leads for

- Who shared or referred the opportunity
- PVAMU department or organization context
- Intended local student audience
- Local recommendation or endorsement
- Referral-source contact details
- When Panther Hub or the contributor received it

### Official application page leads when independently verified for

- Current application status
- Deadline extensions
- Updated eligibility
- Updated application link
- Program cancellation or closure

### Contributor entry

Contributor edits do not silently erase source evidence. The system records the suggested value, contributor-confirmed value, and provenance.

---

## 6. Conflict handling

Flyer-first precedence should reduce routine conflicts, but should not suppress meaningful evidence.

Do not present a conflict when sources are merely complementary. For example:

- Flyer: general eligibility
- Department email: recommended PVAMU graduation terms

Present a conflict when two sources assign different values to the same factual field.

Example:

```text
Deadline shown on flyer: July 17
Deadline stated in newer email: August 15

Suggested value: July 17, based on the official flyer
Warning: A newer source may indicate an extension. Verify against the official application page.
```

Use source date, source authority, and source role to rank evidence. Never resolve a deadline conflict solely from OCR order.

---

## 7. Internal, referred, and external labeling

Do not reduce every source to one ambiguous internal/external tag. Store two separate dimensions.

### Referral origin

- PVAMU department referral
- PVAMU faculty/staff referral
- Registered organization referral
- Sponsor/corporate partner referral
- Alumni referral
- Panther Hub/CODE discovery
- External discovery
- Unknown

### Opportunity relationship or presence

- On-campus
- Campus-connected
- Coming to campus
- PVAMU partner opportunity
- Off-campus
- Remote
- External/general opportunity
- Unknown

An externally operated program can still have a strong internal referral. For example, an Anthropic/CodePath fellowship may be externally operated while being internally referred by a department head.

---

## 8. Student-visible classification

The primary student-facing classifications should be useful for discovery rather than reproducing every organization name as a tag.

### Opportunity category

- Internship
- Co-op
- Research
- Fellowship
- Scholarship
- Full-time employment
- Part-time employment
- Competition
- Hackathon
- Workshop
- Professional development
- Academic reminder
- Other

### Major

Use official College major names plus:

- All engineering majors
- Multiple selected majors
- Other/unspecified

### Industry or sector

Use a broad, maintainable taxonomy:

- Technology/software
- Artificial intelligence/data
- Energy/oil and gas
- Healthcare/biomedical
- Automotive/mobility
- Aerospace/defense
- Construction/infrastructure
- Manufacturing
- Government/public sector
- Finance/financial technology
- Education/nonprofit
- Consulting/professional services
- Telecommunications
- Other

### Qualifications and requirements

Make important requirements visible in structured form where supported:

- Academic classification
- Graduation term
- GPA requirement
- Required skills
- Preferred skills
- Work authorization
- Sponsorship availability
- Experience level
- Age requirement
- Degree requirement
- Application materials

Discipline-specific specializations remain optional. Panther Hub does not need a complete electrical, chemical, civil, mechanical, and computing specialty taxonomy for the first pilot.

### Organization names

Employer, program owner, and partner names should be structured entities and searchable fields. They do not need to be duplicated as decorative tags.

---

## 9. File acceptance

Use one unified Add source experience with type-aware validation.

Initial pilot limits:

- PDF flyer: 15 MB per file
- Screenshot/image: 10 MB per file
- Up to three source artifacts
- 25 MB combined submission limit
- Up to five PDF pages
- PNG, JPEG, WebP, and valid non-encrypted PDF

Do not reject a flyer merely because its aspect ratio is unusual. Reject or normalize based on actual safety and processing constraints:

- Invalid real file type
- Excessive bytes
- Excessive decoded pixel count
- Excessive PDF page count
- Corruption
- Encryption
- Unsafe active content
- Processing timeout

Oversized but otherwise safe images may be downsampled for OCR. Preserve the approved source according to storage policy.

Every failure message must state:

- What failed
- The applicable limit
- How to correct it
- Available alternatives

---

## 10. Confirmation experience

After extraction, show a short guided confirmation rather than a long blank form.

For every core field:

- Pre-fill from sources when possible
- Show Suggested or Extracted
- Let the contributor edit
- Show the supporting source on demand
- Mark genuinely missing required fields

Only ask manual follow-up questions when the provided sources did not answer them or when evidence conflicts.

Advanced optional details stay behind Add more details.

---

## 11. Reviewer comparison

Reviewers should see sources and structured content together:

```text
Flyer/PDF                Program facts, dates, eligibility, compensation
Email screenshot         Audience, referral source, local context
External post/link       Discovery source and current application destination
Contributor corrections Confirmed final structured values
```

Reviewers may:

- Open the original source
- See which source supports each field
- Confirm or change tags
- Resolve conflicts
- Distinguish referrer from public contact
- Request changes
- Approve or reject

---

## 12. Manual email intake for the pilot

Until a Microsoft Graph connector is approved and enabled:

```text
Opportunity reaches CODE mailbox
        ↓
CODE contributor opens or forwards it
        ↓
Contributor creates Panther Hub submission
        ↓
Pastes relevant text and uploads useful attachments/screenshots
        ↓
Parser suggests fields
        ↓
Human confirmation and review
```

Avoid retaining unrelated thread history, signatures, and personal information unless they are relevant to referral provenance.

---

## 13. Recommended email subject convention

Provide a simple convention for departments, organizations, sponsors, alumni, and recruiters:

```text
[PANTHER HUB] [OPPORTUNITY] Program name - deadline
[PANTHER HUB] [EVENT] Event name - event date
[PANTHER HUB] [ANNOUNCEMENT] Short title
```

Examples:

```text
[PANTHER HUB] [FELLOWSHIP] Claude Corps - July 17
[PANTHER HUB] [INTERNSHIP] Summer Engineering Internship - October 1
[PANTHER HUB] [EVENT] NSBE Resume Workshop - September 12
```

The convention should help manual sorting now and future approved mailbox automation later. Messages that do not follow the convention must still be reviewable; the subject format is guidance, not a security boundary.

---

## 14. Data model additions

Recommended entities:

### intake_sessions

- id
- submitter_id
- relationship_to_source
- state
- created_at
- submitted_at

### source_artifacts

- id
- intake_session_id
- source_type
- original_filename
- storage_key
- mime_type
- byte_size
- page_count
- received_at
- source_date
- processing_status

### referral_sources

- intake_session_id
- referral_origin
- person_name
- title
- organization
- department
- email
- phone
- office
- may_display_publicly

### field_suggestions

- intake_session_id
- field_name
- suggested_value
- source_artifact_id
- source_text
- provider
- parser_version
- needs_review
- contributor_value
- contributor_confirmed_at

### content_classifications

- content_id
- classification_type
- classification_value
- source
- confirmed_by
- confirmed_at

---

## 15. Implementation order

1. Add intake session and relationship-to-source question.
2. Add multi-artifact upload records.
3. Add PDF/image validation and private storage.
4. Extract PDF text with OCR fallback.
5. Process all sources independently.
6. Add field-level provenance.
7. Add referral-source and program-contact distinctions.
8. Implement field-category precedence.
9. Add conflict warnings.
10. Add core categories, majors, sectors, and qualifications.
11. Build the guided confirmation screen.
12. Build the reviewer source-comparison screen.
13. Publish the email subject convention.
14. Preserve the same canonical contract for future mailbox and AI adapters.

---

## 16. Acceptance example

For a department-head email screenshot plus an official fellowship flyer, Panther Hub should:

- Use the flyer for program facts and deadline suggestion.
- Use the email for PVAMU audience and referral provenance.
- Identify the department head as the referrer, not automatically the program contact.
- Identify the external organizations as program owners or partners.
- Suggest majors, category, sector, compensation, and qualifications.
- Warn when a displayed deadline appears stale or ambiguous.
- Ask only for missing or conflicting required information.
- Require contributor confirmation.
- Send the completed record to human review.
