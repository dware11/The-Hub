import Link from 'next/link';
import { getViewer, canReview } from '../../lib/auth';
import { getPendingQueue, getSubmissionMetrics } from '../../lib/adminData';
import { getAccessRequests } from '../../lib/committeeData';

function ageDays(value, now = Date.now()) { const created = new Date(value || '').getTime(); return Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 86400000)) : null; }

export default async function WorkspaceOverview() {
  const viewer = await getViewer();
  if (!viewer.user) return <div className="workspace-auth-card"><h1>Sign in required</h1><p>Workspace access is reserved for approved C.O.D.E. contributors and reviewers.</p></div>;
  if (!canReview(viewer)) return <div className="workspace-auth-card"><h1>Workspace access required</h1><p>Your account is signed in, but it does not have an approved workspace role.</p></div>;
  const [queue, metrics, requests] = await Promise.all([getPendingQueue(), getSubmissionMetrics(), getAccessRequests()]);
  const pending = Object.values(queue).flat();
  const now = Date.now();
  const overThree = pending.filter(item => item.status === 'pending' && (ageDays(item.created_at, now) || 0) >= 3).length;
  const closingSoon = queue.opportunities.filter(item => item.deadline && new Date(item.deadline + 'T23:59:59').getTime() <= now + 7 * 86400000).length;
  const pendingAccess = requests.filter(item => item.status === 'pending').length;
  const needsAttention = [...pending.filter(item => (ageDays(item.created_at, now) || 0) >= 5).map(item => ({ priority: 'Urgent', why: `Pending ${ageDays(item.created_at, now)} days`, item, href: '/admin/review' })), ...queue.opportunities.filter(item => item.deadline && new Date(item.deadline + 'T23:59:59').getTime() > now && new Date(item.deadline + 'T23:59:59').getTime() <= now + 7 * 86400000).map(item => ({ priority: 'Warning', why: `Closes ${new Date(item.deadline + 'T12:00:00').toLocaleDateString()}`, item, href: '/admin/review?reviewType=opportunities' }))].slice(0, 8);
  return <div className="workspace-overview"><header className="workspace-page-heading"><div><div className="eyebrow">Workspace overview</div><h1>What needs attention right now?</h1><p>Pending decisions, aging submissions, and access requests in one operational view.</p></div><Link href="/admin/review" className="gold-button">Open review queue</Link></header>
    <section className="workspace-metric-cards" aria-label="Workspace attention metrics"><MetricCard label="Pending review" value={pending.length} href="/admin/review" /><MetricCard label="Over 3 days" value={overThree} tone={overThree ? 'warning' : ''} href="/admin/review" /><MetricCard label="Closing soon" value={closingSoon} href="/admin/review?reviewType=opportunities" /><MetricCard label="Pending access" value={pendingAccess} href="/admin/people" /></section>
    <section className="workspace-attention"><div className="workspace-section-heading"><div><div className="eyebrow">Needs attention</div><h2>Actionable records</h2></div><Link href="/admin/review">View queue →</Link></div>{needsAttention.length ? <div className="workspace-attention-table"><div className="workspace-attention-row workspace-attention-header"><span>Priority</span><span>Item</span><span>Why</span><span>Action</span></div>{needsAttention.map(({ priority, why, item, href }) => <div className="workspace-attention-row" key={`${item.id}-${why}`}><span className={`attention-${priority.toLowerCase()}`}>{priority}</span><span><strong>{item.title}</strong><small>{item.type || 'Submission'} · {item.org || item.source || 'Organization not provided'}</small></span><span>{why}</span><Link href={href}>Review →</Link></div>)}</div> : <div className="workspace-empty">No urgent records right now. New pending submissions will appear here.</div>}</section>
    <footer className="workspace-panther-mark" aria-hidden="true"><span>PVAMU</span><strong>Panther operations</strong></footer>
  </div>;
}

function MetricCard({ label, value, href, tone = '' }) { return <Link href={href} className={`workspace-metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>View records →</small></Link>; }
