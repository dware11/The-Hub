import { redirect } from 'next/navigation';
import { getViewer, isAdmin } from '../../../lib/auth';
import { createServerSupabaseClient, isDemoMode } from '../../../lib/supabaseServerClient';
import IssueManager from './IssueManager';

async function getIssues() {
  if (isDemoMode) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('issue_reports').select('*').order('created_at', { ascending: false });
  if (error) throw new Error('Issue reports could not be loaded.');
  return data || [];
}

export default async function IssuesPage() {
  const viewer = await getViewer();
  if (!viewer.user) redirect('/auth/signin?next=%2Fadmin%2Fissues');
  if (!isAdmin(viewer)) redirect('/admin');
  return <div className="review-page workspace-subpage"><header className="workspace-page-heading"><div><div className="eyebrow">Support operations</div><h1>Issues</h1><p>Review reported content and site problems.</p></div></header><IssueManager issues={await getIssues()} /></div>;
}
