# Panther Hub Content-Type Branching Specification

**Status:** Approved product direction for pilot implementation  
**Relationship:** Supplements `MULTI_SOURCE_INTAKE_SPEC.md`

---

## 1. First decision in the submission flow

Before asking about referral source, files, screenshots, or pasted text, ask:

> What are you sharing with students?

Primary choices:

1. **Event** - Something students can attend at a particular time or through a scheduled series.
2. **Opportunity** - Something students can apply for, join, earn, compete for, or pursue.
3. **Announcement or reminder** - Important information that is not primarily an event or application opportunity.

The selected type determines:

- Follow-up questions
- Parser field priorities
- Suggested tags
- Required fields
- Preview layout
- Review checklist
- Student filters
- Expiration and archival behavior

Do not present all event and opportunity fields in one form.

---

## 2. Shared streamlined pattern

Every branch follows the same understandable rhythm:

```text
Choose content type
        ↓
Explain relationship to the source
        ↓
Add flyer/PDF, screenshot, pasted text, link, or manual details
        ↓
Extract type-specific suggestions
        ↓
Confirm only relevant and missing information
        ↓
Preview
        ↓
Submit for review
```

The parser returns one canonical envelope, but the `fields` section is specialized by content type.

---

## 3. Event branch

Use the event branch for:

- College events
- Registered organization events
- Sponsor or employer events
- Career fairs
- Workshops
- Information sessions
- Competitions occurring at a scheduled time
- Hackathons
- Organization meetings
- Homecoming engineering events
- Academic sessions
- Virtual sessions
- Recurring event series

### Event parser priorities

For an event flyer or source, prioritize:

- Event title
- Event category
- Host organization
- Co-hosts
- Sponsor
- Date
- Start time
- End time
- Time zone for virtual/hybrid events
- Location
- Campus building and room
- Virtual meeting or registration link
- Short description
- Intended audience
- Eligible majors
- Academic classification
- Capacity or registration requirement
- Registration deadline
- Presenter or speaker
- Event contact
- Referral source
- Recurrence

### Event-specific relationship labels

- College-hosted
- Department-hosted
- Student-organization-hosted
- Sponsor-hosted
- Employer-hosted
- Alumni-hosted
- Co-hosted
- External event shared with PVAMU students

### Event presence

- On campus
- Coming to campus
- Campus-connected off-site
- Virtual
- Hybrid
- External/off-campus
- Location to be announced

An event is not automatically on campus. The event branch must support sponsor events, virtual events, off-campus professional events, and external opportunities shared with students.

### Event required fields

- Title
- Description or summary
- Host/source
- Date
- Time or explicit all-day status
- Location or virtual designation
- Registration link or contact method when required
- Eligible audience
- Submitter identity

### Event advanced fields

Keep behind **Add more details**:

- Speaker biography
- Sponsor relationship
- Capacity
- Dress code
- Materials to bring
- Food provided
- Accessibility accommodations
- Check-in instructions
- Recurrence settings
- Multiple selected dates

### Event preview emphasis

The preview should prominently show:

- Date
- Time
- Location
- Host
- Registration action
- Audience
- Sponsor or College-official indicator when confirmed

---

## 4. Opportunity branch

Use the opportunity branch for:

- Internships
- Co-ops
- Full-time employment
- Part-time employment
- Research
- Fellowships
- Scholarships
- Professional-development programs
- Competitions with an application process
- Hackathons with an application or registration process
- Grants
- Leadership programs
- Volunteer opportunities

### Opportunity parser priorities

For an opportunity flyer or source, prioritize:

- Opportunity title
- Opportunity category
- Employer or program owner
- Partner organizations
- Description
- Application deadline
- Application link
- Program start date
- Duration
- Compensation or award
- Paid/funded status
- Work mode
- Location
- Eligible majors
- Academic classification
- Graduation term
- GPA requirement
- Required skills
- Preferred skills
- Work authorization
- Sponsorship availability
- Experience level
- Industry/sector
- Program contact
- Referral source
- Posting or requisition ID

### Opportunity relationship labels

- PVAMU internal opportunity
- PVAMU partner opportunity
- Sponsor opportunity
- Alumni-referred opportunity
- Faculty/department-referred opportunity
- Organization-referred opportunity
- External opportunity discovered by CODE
- External opportunity submitted by a contributor

### Opportunity presence

- On-campus employment or program
- Campus-connected
- Employer coming to campus
- Local/off-campus
- Remote
- Hybrid
- National
- International
- Location varies

### Opportunity required fields

- Title
- Description
- Employer, program owner, or source
- Application deadline or explicit rolling/no-deadline status
- Application link or official contact method
- Eligible majors or all-major designation
- Submitter identity

### Opportunity advanced fields

Keep behind **Add more details**:

- Compensation details
- GPA
- Skills
- Experience level
- Work authorization
- Sponsorship
- Graduation term
- Requisition ID
- Application materials
- Multiple cohorts
- Recurring/annual program details

### Opportunity preview emphasis

The preview should prominently show:

- Deadline
- Paid/funded status
- Employer or program
- Category
- Eligible majors
- Important qualifications
- Location/work mode
- Application action

---

## 5. Announcement or reminder branch

Use the shorter branch for:

- Dean's Office announcements
- Department announcements
- Academic reminders
- Important deadlines that are not applications
- College notices
- Organization notices

Prioritize:

- Title
- Source
- Summary/body
- Effective date
- Expiration date when applicable
- Intended audience
- Link or contact
- College-official and Dean's Office confirmation

Do not show opportunity compensation, work-authorization, or event-location fields unless the contributor changes the content type.

---

## 6. Type-aware source recommendations

### Event

Recommended helper text:

> Add an event flyer for the date, time, location, host, and registration details. Add an email or post screenshot when it provides the intended PVAMU audience, sponsor relationship, or referral context.

### Opportunity

Recommended helper text:

> Add an opportunity flyer or program PDF for eligibility, compensation, deadline, and application details. Add an email or post screenshot when it explains who referred it, which students should consider it, or its PVAMU connection.

### Announcement

Recommended helper text:

> Paste the announcement or add the original notice. Include a source link or supporting screenshot when available.

---

## 7. Classification overlap

Some content can reasonably appear to be both an event and an opportunity.

Examples:

- A hackathon has a scheduled event date and an application deadline.
- A competition includes qualifying rounds and a final event.
- A career fair is an event containing employment opportunities.
- An information session promotes an internship.

For the pilot, ask:

> What is the primary action students should take?

- **Attend or register for a scheduled session** → Event
- **Apply for a position, award, program, or competition** → Opportunity

Allow the record to link to a related event or opportunity later rather than forcing every field into one record.

---

## 8. Parser routing

The conceptual parser remains:

```javascript
parseFlyer(input)
```

The input adds:

```json
{
  "contentType": "event | opportunity | announcement",
  "relationshipToSource": "...",
  "artifacts": [],
  "pastedText": "...",
  "sourceLink": "..."
}
```

The parser uses `contentType` to select relevant extraction rules and output fields. It must not infer and change the contributor's chosen type without confirmation.

If evidence suggests another type, return a warning:

> This source appears to describe an application-based opportunity. Do you want to change from Event to Opportunity?

---

## 9. Review routing

### Event reviewer checks

- Date and time
- Location
- Host and sponsor identity
- Registration
- Campus/College-official status
- Recurrence
- Source-flyer agreement

### Opportunity reviewer checks

- Deadline
- Application destination
- Eligibility
- Compensation claims
- Employer/program identity
- Work authorization language
- Referral versus program contact
- Whether the opportunity remains open

### Announcement reviewer checks

- Source authority
- Audience
- Effective/expiration dates
- College-official or Dean's Office status

---

## 10. Student discovery separation

Student navigation should preserve separate destinations:

- Events
- Opportunities
- Announcements

Each destination receives filters relevant to that content type.

### Event filters

- Date
- Event category
- Major/audience
- On-campus/virtual/off-campus
- Host
- Sponsor
- Registration required

### Opportunity filters

- Deadline
- Opportunity category
- Major
- Paid/funded
- Work mode
- Location
- Academic classification
- Industry/sector
- Important qualifications

This keeps a plentiful platform organized without presenting one oversized universal filter panel.
