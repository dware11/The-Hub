import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOpportunity } from '../../../lib/data';

export default async function OpportunityDetail({ params }) {
  const o = await getOpportunity(params.id);
  if (!o) return notFound();

  return (
    <div className="pb-16">
      <div className="text-sm text-slate mt-6 mb-4">
        <Link href="/opportunities" className="hover:text-purple-700">Opportunities</Link> / {o.title}
      </div>

      <div className="grid md:grid-cols-[1.7fr_1fr] gap-7 items-start">
        <div className="bg-white border border-line rounded-2xl p-8">
          <div className="flex gap-2 mb-4">
            <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{o.type}</span>
            {o.paid && <span className="font-mono text-[10px] bg-gold-100 text-gold-600 px-2 py-0.5 rounded">Paid</span>}
          </div>
          <h1 className="text-2xl mb-2">{o.title}</h1>
          <div className="flex items-center gap-2 text-sm text-slate mb-6">
            Posted by {o.org}
            {o.verified && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                ✓ Verified
              </span>
            )}
          </div>

          <Section title="About this opportunity">
            <p className="text-sm leading-relaxed text-ink/80">{o.description}</p>
          </Section>

          <Section title="Details">
            <ul className="text-sm leading-loose text-ink/80 list-disc pl-5">
              {o.location && <li><strong className="text-ink">Location:</strong> {o.location}</li>}
              <li><strong className="text-ink">Majors:</strong> {(o.majors || []).join(', ')}</li>
            </ul>
          </Section>
        </div>

        <div>
          <SideCard title="Apply">
            <div className="font-mono text-xl text-coral mb-1">
              {new Date(o.deadline).toLocaleDateString()}
            </div>
            <div className="text-xs text-slate mb-4">Deadline to apply</div>
            <a
              href={o.link}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-purple-900 text-white text-sm py-3 rounded-lg hover:bg-purple-700"
            >
              View application →
            </a>
          </SideCard>

          <SideCard title="Point of contact">
            <div className="text-sm font-medium">{o.contact_name}</div>
            <a href={`mailto:${o.contact_email}`} className="text-sm text-purple-700 block mt-1 hover:underline">
              {o.contact_email}
            </a>
            {o.contact_linkedin && (
              <a href={o.contact_linkedin} target="_blank" rel="noreferrer" className="text-sm text-purple-700 block mt-1 hover:underline">
                Connect on LinkedIn
              </a>
            )}
          </SideCard>

          {o.flyer_url && (
            <SideCard title="Original flyer">
              <a href={o.flyer_url} target="_blank" rel="noreferrer" className="block group">
                <img
                  src={o.flyer_url}
                  alt="Original flyer"
                  className="w-full rounded-lg border border-line group-hover:border-gold-400"
                />
                <span className="text-xs text-purple-700 mt-2 inline-block group-hover:underline">
                  View original flyer →
                </span>
              </a>
            </SideCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="font-mono text-xs uppercase tracking-wide text-slate mb-2">{title}</h3>
      {children}
    </div>
  );
}

function SideCard({ title, children }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-6 mb-4">
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-slate mb-4">{title}</h3>
      {children}
    </div>
  );
}
