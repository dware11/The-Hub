import { isDemoMode, createServerSupabaseClient } from './supabaseServerClient';

const demoPeople = [
  { id: 'demo-super-admin', name: 'Demo Contributor', email: 'demo@pvamu.edu', organization_department: 'C.O.D.E.', role: 'super_admin', status: 'active', assigned_by: 'Bootstrap', assigned_at: '2026-08-23T00:00:00Z', last_submission: '2026-09-02T15:00:00Z' },
  { id: 'demo-reviewer', name: 'Website Committee Reviewer', email: 'reviewer@pvamu.edu', organization_department: 'College of Engineering', role: 'reviewer', status: 'active', assigned_by: 'C.O.D.E. administration', assigned_at: '2026-08-25T00:00:00Z', last_submission: null },
  { id: 'demo-contributor', name: 'Demo Student Organization', email: 'org@pvamu.edu', organization_department: 'Student organization', role: 'contributor', status: 'needs_review', assigned_by: null, assigned_at: '2026-08-30T00:00:00Z', last_submission: null },
];

export async function getPeopleRoster(viewer) {
  const superAdmin = viewer?.role?.role === 'super_admin';
  if (isDemoMode) return superAdmin ? demoPeople : demoPeople.filter(row => ['contributor','reviewer'].includes(row.role));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_people_access_roster');
  if (error) throw new Error('People roster unavailable');
  return superAdmin ? (data || []) : (data || []).filter(row => ['contributor','reviewer'].includes(row.role));
}
