'use client';

import { useState, useTransition } from 'react';
import { approveItem, rejectItem } from './actions';

const SECTIONS = [
  { key: 'opportunities', type: 'opportunity', label: 'Opportunities' },
  { key: 'events', type: 'event', label: 'Events' },
  { key: 'announcements', type: 'announcement', label: 'Announcements' },
];

export default function ReviewQueue({ queue }) {
  const [items, setItems] = useState(queue);
  const [pendingId, setPendingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  function decide(type, key, id, action) {
    setPendingId(id);
    startTransition(async () => {
      const result = action === 'approve' ? await approveItem(type, id) : await rejectItem(type, id);
      if (result.ok) {
        setItems((prev) => ({ ...prev, [key]: prev[key].filter((item) => item.id !== id) }));
      }
      setPendingId(null);
    });
  }

  const total = items.opportunities.length + items.events.length + items.announcements.length;

  if (total === 0) {
    return <div className="text-sm text-slate py-12 text-center">Nothing waiting on review. 🎉</div>;
  }

  return (
    <div className="flex flex-col gap-10">
      {SECTIONS.map(({ key, type, label }) =>
        items[key].length === 0 ? null : (
          <div key={key}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-1.5 h-1.5 bg-gold-600 rounded-sm flex-shrink-0" />
              <div className="flex-1 h-px bg-line" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate whitespace-nowrap">
                {label} ({items[key].length})
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {items[key].map((item) => (
                <div key={item.id} className="bg-white border border-line rounded-lg px-5 py-4">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-display font-semibold">{item.title}</div>
                      <div className="text-xs text-slate mt-0.5">
                        {item.org || item.source}
                        {item.submitted_by && (
                          <>
                            {' · submitted by '}
                            {item.submitted_by.full_name || item.submitted_by.email}
                          </>
                        )}
                      </div>
                      <div className="text-sm text-ink/80 mt-2 line-clamp-2">{item.description || item.body}</div>
                      <div className="flex flex-wrap gap-3 mt-2 font-mono text-[11px] text-slate">
                        {item.deadline && <span>Deadline {new Date(item.deadline).toLocaleDateString()}</span>}
                        {item.date && <span>Date {new Date(item.date).toLocaleDateString()}</span>}
                        {item.contact_email && <span>{item.contact_email}</span>}
                        {item.flyer_url && (
                          <a href={item.flyer_url} target="_blank" rel="noreferrer" className="text-purple-700 hover:underline">
                            View original flyer →
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        disabled={isPending && pendingId === item.id}
                        onClick={() => decide(type, key, item.id, 'reject')}
                        className="font-mono text-xs border border-line text-slate px-3 py-1.5 rounded-md hover:border-coral hover:text-coral disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={isPending && pendingId === item.id}
                        onClick={() => decide(type, key, item.id, 'approve')}
                        className="font-mono text-xs bg-purple-900 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isPending && pendingId === item.id ? 'Working…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
