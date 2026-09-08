import { createServerSupabaseClient, isDemoMode } from './supabaseServerClient';
import { demoCurrentUser } from './sampleData';

// Everything a page needs to know about "who is asking": the Supabase auth
// user (if signed in) plus their row in user_roles (if verified). Demo mode
// simulates a signed-in, verified admin so the whole flow -- submit form,
// admin review queue -- is walkable without real auth configured.
export async function getViewer() {
  if (isDemoMode) return { ...demoCurrentUser, demo: true };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null, demo: false };

  let { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (roleError) throw new Error('Panther Hub could not verify your access role.');

  if (!role) {
    const { error: claimError } = await supabase.rpc('claim_my_role');
    if (claimError) throw new Error('Your verified email could not be checked for an approved Hub role.');
    if (!claimError) {
      const claimed = await supabase
        .from('user_roles')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      role = claimed.data;
    }
  }


  return { user, role, demo: false };
}

export function canSubmit(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      ['super_admin', 'admin', 'reviewer', 'contributor'].includes(viewer.role.role)
  );
}

export function canReview(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      ['super_admin', 'admin', 'reviewer'].includes(viewer.role.role)
  );
}

export function isAdmin(viewer) {
  return Boolean(
    viewer.role &&
      viewer.role.status === 'active' &&
      ['super_admin', 'admin'].includes(viewer.role.role)
  );
}

export const isVerifiedContributor = canSubmit;

export function isSuperAdmin(viewer) {
  return Boolean(viewer.role?.status === 'active' && viewer.role.role === 'super_admin');
}
