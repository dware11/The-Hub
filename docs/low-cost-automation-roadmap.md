# C.O.D.E. Engineering Hub low-cost automation roadmap

This is planning documentation only. No paid service or new automation is enabled by this pass.

## V1 operating model

- Human review remains required before publication.
- Admins control Spotlight order, Home event visibility, and content lifecycle.
- Super Admin alone can permanently delete a record, with a reason and audit event.
- The existing weekly digest endpoint stays fail-closed behind `CRON_SECRET`.

## Suggested next steps

1. Use the existing Vercel Cron allowance for the weekly digest only after Resend and recipient ownership are approved.
2. Add a daily read-only health check for `/api/health`, failed source artifacts, and aging review items; alert only when action is needed.
3. Add scheduled expiry/unfeature checks through audited database functions instead of direct table mutations.
4. Export audit summaries and database backups on a documented retention schedule before expanding the contributor group.
5. Add link-health checks that create review tasks; never auto-rewrite or publish content.
6. Revisit batch submission only after individual intake metrics show a real need. Keep the V1 “submit another” path meanwhile.

## Guardrails

- No service-role key in browser code.
- No automation may bypass RLS, review evidence, or publication approval.
- Every write must have an identifiable actor, bounded input, and audit record.
- Prefer free platform allowances first; document cost and ownership before enabling a paid dependency.
