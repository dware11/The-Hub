import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const migration=readFileSync('supabase/migrations/20261005015834_people_invite_affiliation_workflow.sql','utf8');
const roleMigration=readFileSync('supabase/migrations/20261005022228_people_invite_role_selection.sql','utf8');
const polishMigration=readFileSync('supabase/migrations/20261005030913_people_invite_name_and_email_polish.sql','utf8');
const removalMigration=readFileSync('supabase/migrations/20261005033150_remove_person_preserve_history.sql','utf8');
const actions=readFileSync('app/admin/people/actions.js','utf8');
const invitePage=readFileSync('app/admin/people/invite/page.js','utf8');
const inviteForm=readFileSync('app/admin/people/invite/InvitePersonForm.js','utf8');
const peoplePage=readFileSync('app/admin/people/page.js','utf8');

// Server and database authorization must independently require Super Admin.
assert.match(invitePage,/isSuperAdmin\(viewer\)[\s\S]*redirect\('\/admin\/people'\)/);
assert.match(actions,/export async function invitePerson[\s\S]*if \(!isSuperAdmin\(viewer\)\)/);
assert.match(actions,/export async function resendPersonInvitation[\s\S]*if \(!isSuperAdmin\(viewer\)\)/);
assert.match(actions,/export async function cancelPersonInvitation[\s\S]*if \(!isSuperAdmin\(viewer\)\)/);
assert.match(migration,/role='super_admin'/);
assert.doesNotMatch(migration,/d\.ware9873@gmail\.com/i);

// Pending invitations are real preauthorization records, not fake Auth users.
assert.match(migration,/create table public\.people_invitations/);
assert.match(migration,/create unique index people_invitations_one_pending_email/);
assert.match(migration,/intended_role text not null default 'contributor'/);
assert.match(roleMigration,/p_intended_role not in \('contributor','reviewer','admin'\)/);
assert.match(roleMigration,/check\(intended_role in \('contributor','reviewer','admin'\)\)/);
assert.doesNotMatch(roleMigration,/p_intended_role[^\n]*super_admin/);
assert.match(migration,/status text not null default 'pending'/);
assert.doesNotMatch(migration,/insert into auth\.users/i);

// First verified login reconciles from locked database values; accepted or
// deactivated invitations are not eligible for silent reactivation.
assert.match(migration,/email_confirmed_at is not null/);
assert.match(migration,/where email=caller_email and status='pending' for update/);
assert.match(migration,/values\(invitation\.email,caller_id,invitation\.intended_role,'active'/);
assert.match(migration,/set status='accepted',accepted_at=now\(\)/);
assert.match(migration,/accepted invitations are never reconsidered by claim_my_role/);
assert.match(removalMigration,/create or replace function public\.remove_person_access/);
assert.match(removalMigration,/set status='removed',auth_user_id=null/);
assert.match(removalMigration,/ur\.status<>'removed'/);
assert.match(removalMigration,/where lower\(trim\(email\)\)=caller_email and status='removed'/);
assert.match(removalMigration,/status='removed'[\s\S]*status='active'/);

// Affiliation stays independent of Hub role and organizations are controlled.
for (const value of ['student_organization','department','college','university_office','none']) assert.ok(migration.includes(value));
assert.match(migration,/taxonomy_scope='organization'/);
assert.match(inviteForm,/Initial Hub Access/);
assert.match(inviteForm,/name="first_name" required/);
assert.match(inviteForm,/name="last_name" required/);
assert.match(polishMigration,/normalized_first is null or normalized_last is null/);
assert.match(polishMigration,/normalized_first\|\|' '\|\|normalized_last/);
assert.match(inviteForm,/name="intended_role"/);
for (const role of ['contributor','reviewer','admin']) assert.match(inviteForm,new RegExp(`<option value="${role}">`));
assert.doesNotMatch(inviteForm,/<option value="super_admin">/);
assert.match(inviteForm,/Can’t find your organization\? Request it\./);
assert.match(inviteForm,/organizationRequest/);

// Creation sends once; only explicit resend requests another delivery.
assert.match(migration,/if not p_resend and exists/);
assert.match(migration,/unique\(invitation_id,attempt_number\)/);
assert.match(actions,/sendPeopleInvitation\(\{ supabase, invitationId: data\.invitation_id \}\)/);
assert.match(actions,/sendPeopleInvitation\(\{ supabase, invitationId, resend: true \}\)/);
assert.match(peoplePage,/superAdmin&&<a className="gold-button" href="\/admin\/people\/invite">Add Person<\/a>/);

const notificationSource=readFileSync('lib/notifications.js','utf8');
const context=vm.createContext({});
const module=new vm.SourceTextModule(notificationSource,{context});
await module.link(()=>{throw new Error('Unexpected notification dependency');});
await module.evaluate();
for (const intendedRole of ['contributor','reviewer','admin']) {
const email=module.namespace.buildPeopleInvitationEmail({firstName:'Deja',intendedRole,destination:'https://hub.codepv.org'});
assert.equal(email.subject,'You’ve been added to the C.O.D.E. Engineering Hub');
for (const value of ['Your Hub access is ready','Hello Deja','six-digit verification code','https://hub.codepv.org','Sign In to the Hub','YOUR ACCESS']) {
  assert.ok(email.text.includes(value)); assert.ok(email.html.includes(value));
}
const universalEmail=module.namespace.buildPeopleInvitationEmail({firstName:'Deja',destination:'https://hub.codepv.org'});
for (const forbiddenRoleCopy of ['You can submit events','help review and publish','help oversee submissions']) {
  assert.ok(!universalEmail.text.includes(forbiddenRoleCopy));
  assert.ok(!universalEmail.html.includes(forbiddenRoleCopy));
}
for (const forbidden of ['Magic Link','vercel.app','auth/confirm','provider_id','database']) {
  assert.ok(!email.text.includes(forbidden)); assert.ok(!email.html.includes(forbidden));
}
}

console.log('People invitation checks passed: Super Admin authorization, pending lifecycle, deduplication, affiliation separation, first-login reconciliation, deactivation safety, and branded email rendering.');
