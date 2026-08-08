import Link from 'next/link';
import { getOpportunities } from '../../lib/data';
import MajorFilter from '../../components/MajorFilter';

export default async function OpportunitiesPage({ searchParams }) {
  const { major } = await searchParams;
  const opportunities = await getOpportunities(major);

  return (
    <div className="pb-16">
      <div className="mt-9 mb-6 flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-purple-900">Opportunities</h1>
          <div className="text-sm text-slate mt-1">
            {opportunities.length} open · internships, research, scholarships &amp; more
          </div>
        </div>
        <MajorFilter current={major} />
      </div>

      <div className="flex flex-col gap-3">
        {opportunities.map((o) => (
          <Link
            href={`/opportunities/${o.id}`}
            key={o.id}
            className="bg-white border border-line rounded-lg px-5 py-4 flex justify-between items-center gap-5 hover:border-gold-400 flex-wrap"
          >
            <div className="min-w-0">
              <div className="flex gap-2 mb-2">
                <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  {o.type}
                </span>
                {o.paid && (
                  <span className="font-mono text-[10px] bg-gold-100 text-gold-600 px-2 py-0.5 rounded">
                    Paid
                  </span>
                )}
              </div>
              <div className="font-display font-semibold">{o.title}</div>
              <div className="text-xs text-slate">Posted by {o.org}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] uppercase text-slate">Deadline</div>
              <div className="font-mono text-sm text-coral">
                {new Date(o.deadline).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
        {opportunities.length === 0 && (
          <div className="text-sm text-slate py-12 text-center">No opportunities posted yet.</div>
        )}
      </div>
    </div>
  );
}
