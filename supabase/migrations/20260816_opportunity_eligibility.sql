-- Preserve OCR-extracted eligibility as a separate, reviewer-editable field.
alter table opportunities
  add column if not exists eligibility text;

comment on column opportunities.eligibility is 'Student-facing eligibility and qualification requirements confirmed during intake review.';
