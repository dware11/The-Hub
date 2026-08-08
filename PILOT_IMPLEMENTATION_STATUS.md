# Panther Hub Pilot Implementation Status

This file tracks implementation against the attached Panther Hub Student Pilot
Implementation Directive.

## Foundation started

- [x] Provider-neutral contract definitions
- [x] Disabled manual-mode mail connector boundary
- [x] Explicit environment and feature-flag configuration module
- [x] Server-side submission validation module
- [x] Server action that derives contributor ownership from the authenticated viewer
- [x] Ownership-enforcing RLS migration for all content types
- [x] Consistent own-submission read policies
- [x] Append-only audit-event schema
- [x] Automatic submission/status audit triggers
- [x] Digest-run/idempotency schema
- [x] Safe public health endpoint
- [x] Docker and locked dependency scaffolding

## Integration still required

- [ ] Connect the existing client submission form to `submitContentAction`
- [ ] Switch existing demo-mode detection to explicit `DEMO_MODE`
- [ ] Remove live query fallback to sample records
- [ ] Add cached published snapshots and timestamped degraded-state UI
- [ ] Convert incoming flyer storage to private access
- [ ] Add protected reviewer file delivery
- [ ] Connect digest route to `digest_runs` and fail closed
- [ ] Add administrator health view and persistent health history
- [ ] Extend the parser to the canonical versioned field envelope
- [ ] Add targeted tests from Directive section 22

## Migration caution

`20260730_panther_hub_pilot_foundation.sql` intentionally stops if any existing
content record has a null `submitted_by`. Backfill those rows with verified
ownership before applying the non-null constraint.

No migration in this directory has been applied to a live Supabase project by
Codex. Apply only after backup and review.
