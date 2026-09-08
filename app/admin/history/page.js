import { getViewer, isSuperAdmin } from '../../../lib/auth';
import { getAuditEvents } from '../../../lib/auditData';
import HistoryBrowser from './HistoryBrowser';
export default async function HistoryPage() { const viewer = await getViewer(); if (!viewer.user || !isSuperAdmin(viewer)) return <div className="workspace-auth-card"><h1>Super Admin access required</h1><p>History is restricted to the Super Admin role.</p></div>; const { rows, demo } = await getAuditEvents(); return <div className="workspace-overview"><div className="workspace-page-heading"><div><div className="eyebrow">Immutable audit trail</div><h1>History</h1><p>Privileged actions across content, access, review, and system administration.</p></div></div><HistoryBrowser rows={rows} demo={demo} /></div>; }
