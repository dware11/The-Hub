'use client';

import { useMemo, useState } from 'react';
import { updateIssueStatus, reviewOrganizationRequest } from '../../report/actions';
import { CONTENT_ISSUES, SITE_ISSUES, OPPORTUNITY_ISSUES, EVENT_ISSUES } from '../../../lib/issueTypes';

export default function IssueManager({ issues }) {
  const [items, setItems] = useState(issues);
  const [view, setView] = useState('active');
  const [issueType, setIssueType] = useState('');
  const [typeGroup, setTypeGroup] = useState('all');
  const [decisionNote,setDecisionNote]=useState({});
  const [message, setMessage] = useState('');
  async function update(id, status) {
    setMessage('Saving…');
    const result = await updateIssueStatus(id, status);
    if (result.ok) setItems((current) => current.map((issue) => issue.id === id ? { ...issue, status } : issue));
    setMessage(result.ok ? 'Issue status updated.' : result.error);
  }
  async function decideOrganization(issue, decision) {
    setMessage(`${decision === 'approved' ? 'Approving' : 'Rejecting'} organization request…`);
    const result=await reviewOrganizationRequest(issue.id,decision,decisionNote[issue.id]||'');
    if(result.ok)setItems(current=>current.map(item=>item.id===issue.id?{...item,status:'resolved',resolution_outcome:decision}:item));
    setMessage(result.ok?`Organization request ${decision}.`:result.error);
  }
  const issueTypes = useMemo(() => [...new Set([...SITE_ISSUES, ...CONTENT_ISSUES, ...OPPORTUNITY_ISSUES, ...EVENT_ISSUES, ...items.map((issue) => issue.issue_type).filter(Boolean)])].sort((a, b) => a.localeCompare(b)), [items]);
  const shown = items.filter((issue) => {
    const statusMatches = view === 'all' || (view === 'active' ? issue.status !== 'resolved' : issue.status === 'resolved');
    const groupMatches=typeGroup==='all'||(typeGroup==='organization'&&issue.issue_type==='Organization addition request')||(typeGroup==='content'&&Boolean(issue.content_type))||(typeGroup==='site'&&!issue.content_type&&issue.issue_type!=='Organization addition request');
    return statusMatches && groupMatches && (!issueType || issue.issue_type === issueType);
  });
  const activeCount = items.filter((issue) => issue.status !== 'resolved').length;
  const resolvedCount = items.length - activeCount;
  return <section className="issues-panel">
    <div className="content-tabs" role="tablist" aria-label="Issue status">
      <button type="button" role="tab" aria-selected={view === 'active'} className={view === 'active' ? 'active' : ''} onClick={() => setView('active')}>Active <span>{activeCount}</span></button>
      <button type="button" role="tab" aria-selected={view === 'resolved'} className={view === 'resolved' ? 'active' : ''} onClick={() => setView('resolved')}>Resolved <span>{resolvedCount}</span></button>
      <button type="button" role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All <span>{items.length}</span></button>
    </div>
    <div className="issue-filters">
      <label><span>Type</span><select value={typeGroup} onChange={(event)=>setTypeGroup(event.target.value)}><option value="all">All</option><option value="organization">Organization Requests</option><option value="content">Content Reports</option><option value="site">Site Issues</option></select></label>
      <label><span>Issue type</span><select value={issueType} onChange={(event) => setIssueType(event.target.value)}><option value="">All issue types</option>{issueTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      {(issueType||typeGroup!=='all') && <button type="button" className="clear-filters" onClick={() => {setIssueType('');setTypeGroup('all');}}>Clear filters</button>}
    </div>
    <p className="workspace-status" role="status" aria-live="polite">{message || `${shown.length} ${view} issue${shown.length === 1 ? '' : 's'} shown.`}</p>
    {shown.length ? <div className="issues-table"><div className="issues-row issues-header"><span>Status</span><span>Issue</span><span>Page</span><span>Reported</span><span>Actions</span></div>{shown.map(issue => <article className="issues-row" key={issue.id}><span className={`issue-status issue-${issue.status}`}>{issue.status.replace('_', ' ')}</span><span><strong>{issue.issue_type}</strong><small>{issue.description}</small>{issue.request_details && <dl className="organization-request-details"><div><dt>Organization</dt><dd>{issue.request_details.organization_name}</dd></div><div><dt>Type</dt><dd>{issue.request_details.organization_type}</dd></div>{issue.request_details.organization_contact_name && <div><dt>Contact</dt><dd>{issue.request_details.organization_contact_name}</dd></div>}{issue.request_details.organization_contact_email && <div><dt>Contact email</dt><dd>{issue.request_details.organization_contact_email}</dd></div>}{issue.request_details.official_website && <div><dt>Official page</dt><dd><a href={issue.request_details.official_website} target="_blank" rel="noreferrer">Open source ↗</a></dd></div>}</dl>}{issue.reporter_email && <small>{issue.issue_type === 'Organization addition request' ? 'Requested by' : 'Reporter'}: {issue.reporter_email}</small>}{issue.resolution_outcome&&<small>Decision: {issue.resolution_outcome}</small>}</span><span><a href={issue.page_url}>{issue.content_type || 'Site'} ↗</a></span><time>{new Date(issue.created_at).toLocaleDateString()}</time><span className="issue-actions">{issue.status === 'open' && <button onClick={() => update(issue.id, 'in_review')}>Mark in review</button>}{issue.issue_type==='Organization addition request'&&issue.status!=='resolved'?<><button className="gold-button" onClick={()=>decideOrganization(issue,'approved')}>Approve organization</button><textarea rows="2" value={decisionNote[issue.id]||''} onChange={event=>setDecisionNote(current=>({...current,[issue.id]:event.target.value}))} placeholder="Reason required to reject"/><button className="chip" onClick={()=>decideOrganization(issue,'rejected')}>Reject request</button></>:issue.status !== 'resolved' && <button onClick={() => update(issue.id, 'resolved')}>Resolve</button>}</span></article>)}</div> : <div className="workspace-empty">{items.length ? 'No issues match the selected status and issue type.' : 'No issue reports yet.'}</div>}
  </section>;
}
