import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260923142441_repair_manage_user_role_authorization.sql'),
  'utf8',
);

// Exact regression: authenticated callers are not enough. The database must
// positively allowlist an active admin or super_admin before any target lookup
// or mutation, so contributors, reviewers, pending/inactive users, and future
// non-administrative roles fail closed.
assert.match(migration, /auth_user_id = \(select auth\.uid\(\)\)[\s\S]*status = 'active'/);
assert.match(migration, /actor\.id is null or actor\.role not in \('admin', 'super_admin'\)/);
assert.doesNotMatch(migration, /actor\.role\s*=\s*'reviewer'\s+then raise/, 'Do not use a denylist that can miss contributor or future roles');

// Admin scope, self-protection, last-super-admin protection, and role
// revocation through needs_review remain intact.
assert.match(migration, /actor\.role = 'admin'[\s\S]*p_role not in \('contributor', 'reviewer'\)[\s\S]*target\.role in \('admin', 'super_admin'\)/);
assert.match(migration, /target\.id = actor\.id[\s\S]*p_status <> 'active'/);
assert.match(migration, /target\.role = 'super_admin'[\s\S]*p_role <> 'super_admin' or p_status <> 'active'/);
assert.match(migration, /remaining_super_admins < 1/);
assert.match(migration, /p_status not in \('active', 'needs_review'\)/);

// SECURITY DEFINER must have a fixed path and a deliberately narrow ACL.
assert.match(migration, /security definer[\s\S]*set search_path = ''/);
assert.match(migration, /revoke all on function public\.manage_user_role\(uuid, text, text\)[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.manage_user_role\(uuid, text, text\)[\s\S]*to authenticated/);
assert.doesNotMatch(migration, /grant\s+all|service_role/i);

console.log('Role-management security checks passed: explicit admin allowlist, preserved governance, fixed SECURITY DEFINER path, and constrained EXECUTE grants.');
