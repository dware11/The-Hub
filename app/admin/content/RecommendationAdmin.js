'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveRecommendation } from './recommendActions';

export default function RecommendationAdmin({ rows, featured = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [message, setMessage] = useState('');
  useEffect(() => setItems(rows), [rows]);

  async function act(row, decision) {
    setMessage('Saving decision…');
    const result = await resolveRecommendation(row.announcement_id, decision);
    if (!result.ok) { setMessage(result.error || 'Could not save decision.'); return; }
    setItems(current => current.filter(item => item.id !== row.id));
    setMessage(decision === 'approve_recommendation' ? 'Content was set as Homepage Spotlight and the decision was audited.' : 'Recommendation declined and audited.');
    if (!result.demo) router.refresh();
  }

  const current = featured[0];
  return <section className="recommendation-admin spotlight-module spotlight-module-compact">
    <div className="spotlight-current"><small>Homepage Spotlight</small><strong>{current?.title || 'No featured item'}</strong>{featured.length > 1 && <span>+ {featured.length - 1} featured</span>}</div>
    {items.length > 0 && <details className="spotlight-recommendations"><summary>Review {items.length} pending {items.length === 1 ? 'recommendation' : 'recommendations'}</summary><div className="spotlight-pending">{items.map(row => <article key={row.id}><div><strong>{row.announcement_title}</strong><small>Recommended by {row.reviewer_name} · {new Date(row.created_at).toLocaleDateString()}</small></div><div className="recommendation-actions"><Link className="chip" href={`/announcements/${row.announcement_id}`}>View</Link><button className="chip" onClick={() => act(row, 'reject_recommendation')}>Decline</button><button className="gold-button" onClick={() => act(row, 'approve_recommendation')}>Set as Spotlight</button></div></article>)}</div></details>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
