'use server';

import { revalidatePath } from 'next/cache';
import { getViewer, isAdmin, isSuperAdmin } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import { sendPeopleInvitation } from '../../../lib/notifications';

export async function changeUserRole(id, role, status) {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) return { ok: false, error: 'Administrator access required.' };
  if (!['contributor', 'reviewer', 'admin', 'super_admin'].includes(role) || !['active', 'needs_review'].includes(status)) return { ok: false, error: 'Invalid role or status.' };
  if (viewer.role?.role === 'admin' && !['contributor', 'reviewer'].includes(role)) return { ok: false, error: 'Administrators may manage contributors and reviewers only.' };
  if (isDemoMode) { revalidatePath('/admin/people'); return { ok: true, demo: true }; }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('manage_user_role', { p_user_role_id: id, p_role: role, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/people');
  return { ok: true, data };
}

const AFFILIATION_TYPES = new Set(['student_organization','department','college','university_office','none']);
const INVITABLE_ROLES = new Set(['contributor','reviewer','admin']);

export async function invitePerson(input) {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer)) return { ok: false, error: 'Super administrator access required.' };
  const email = String(input?.email || '').trim().toLowerCase();
  const firstName = String(input?.firstName || '').trim().slice(0,80);
  const lastName = String(input?.lastName || '').trim().slice(0,80);
  const intendedRole = String(input?.intendedRole || '');
  const affiliationType = String(input?.affiliationType || 'none');
  const affiliationValue = String(input?.affiliationValue || '').trim().slice(0,240);
  const organizationId = String(input?.organizationId || '').trim() || null;
  if (!/^[^\s@]+@pvamu\.edu$/i.test(email)) return { ok: false, error: 'Enter a valid PVAMU email address.' };
  if (!firstName || !lastName) return { ok: false, error: 'Enter the person’s first and last name.' };
  if (!INVITABLE_ROLES.has(intendedRole)) return { ok: false, error: 'Choose Contributor, Reviewer, or Admin for initial Hub access.' };
  if (!AFFILIATION_TYPES.has(affiliationType)) return { ok: false, error: 'Choose a valid affiliation type.' };
  if (affiliationType === 'student_organization' && !organizationId) return { ok: false, error: 'Choose an approved student organization.' };
  if (!['student_organization','none'].includes(affiliationType) && !affiliationValue) return { ok: false, error: 'Enter the affiliation name.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_people_invitation', {
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_intended_role: intendedRole,
    p_affiliation_type: affiliationType,
    p_affiliation_value: affiliationValue || null,
    p_approved_organization_id: organizationId,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.message || 'This invitation could not be created.', reason: data?.reason };
  const delivery = await sendPeopleInvitation({ supabase, invitationId: data.invitation_id });
  revalidatePath('/admin/people');
  if (!delivery.ok) return { ok: true, emailSent: false, warning: 'The invitation was saved, but the email could not be sent. Use Resend Invitation from People & Access.' };
  return { ok: true, emailSent: true };
}

export async function resendPersonInvitation(invitationId) {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer)) return { ok: false, error: 'Super administrator access required.' };
  if (!/^[0-9a-f-]{36}$/i.test(String(invitationId || ''))) return { ok: false, error: 'Invitation not found.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const delivery = await sendPeopleInvitation({ supabase, invitationId, resend: true });
  revalidatePath('/admin/people');
  return delivery.ok ? { ok: true } : { ok: false, error: 'The invitation email could not be sent. Please try again.' };
}

export async function cancelPersonInvitation(invitationId) {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer)) return { ok: false, error: 'Super administrator access required.' };
  if (!/^[0-9a-f-]{36}$/i.test(String(invitationId || ''))) return { ok: false, error: 'Invitation not found.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('cancel_people_invitation', { p_invitation_id: invitationId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/people');
  return { ok: true };
}

export async function removePerson(userRoleId) {
  const viewer = await getViewer();
  if (!isSuperAdmin(viewer)) return { ok: false, error: 'Super administrator access required.' };
  if (!/^[0-9a-f-]{36}$/i.test(String(userRoleId || ''))) return { ok: false, error: 'Person not found.' };
  if (isDemoMode) return { ok: true, demo: true };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('remove_person_access', { p_user_role_id: userRoleId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/people');
  return { ok: true };
}
