import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOpportunity } from '../../../lib/data';
import CalendarActions from '../../../components/CalendarActions';
import EngagementTracker, { TrackedExternalLink } from '../../../components/EngagementTracker';

function displayDate(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString();
}

export default async function OpportunityDetail({ params }) {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) return notFound();
  const isPvamuContact = /pvamu/i.test(o.contact_context || '') || /@pvamu\.edu$/i.test(o.contact_email || '');

  return (
    <div className="page-wrap pb-16 opportunity-detail">
      <EngagementTracker contentType="opportunity" contentId={o.id} action="detail_view" />
      <div className="text-sm text-slate mt-6 mb-4 opportunity-breadcrumb">
        <Link href="/opportunities" className="hover:text-purple-700">Opportunities</Link> / {o.title}
      </div>

      <div className="grid md:grid-cols-[1.7fr_1fr] gap-7 items-start opportunity-detail-layout">
        <div className="bg-white border border-line rounded-2xl p-8 opportunity-detail-main">
          <div className="flex gap-2 mb-4 opportunity-detail-tags">
            <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{o.type}</span>
            {(o.compensation_type || o.paid) && <span className="font-mono text-[10px] bg-gold-100 text-gold-600 px-2 py-0.5 rounded">{o.compensation_type || 'Paid'}</span>}
            {o.work_mode && <span className="font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{o.work_mode}</span>}
          </div>
          <h1 className="text-2xl mb-2">{o.title}</h1>
          <div className="flex items-center gap-2 text-sm text-slate mb-6">
            Organization: {o.org}
            {o.verified && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                ✓ Verified
              </span>
            )}
          </div>

          <Section title="About this opportunity" className="opportunity-detail-section">
            <p className="text-sm leading-relaxed text-ink/80">{o.description}</p>
          </Section>

          {o.eligibility && (
            <Section title="Eligibility and requirements" className="opportunity-detail-section">
              <p className="text-sm leading-relaxed text-ink/80">{o.eligibility}</p>
            </Section>
          )}

          <Section title="Details and classifications" className="opportunity-detail-section">
            <ul className="text-sm leading-loose text-ink/80 list-disc pl-5">
              {o.location && <li><strong className="text-ink">Location:</strong> {o.location}</li>}
              <li><strong className="text-ink">Majors:</strong> {(o.majors || []).join(', ')}</li>
              {o.classifications?.length > 0 && <li><strong className="text-ink">Classifications:</strong> {o.classifications.join(', ')}</li>}
              {o.work_mode && <li><strong className="text-ink">Format:</strong> {o.work_mode}</li>}
            </ul>
          </Section>
        </div>

        <div className="opportunity-detail-rail">
          <SideCard title="Apply" className="opportunity-side-card">
            <div className="font-mono text-xl text-coral mb-1">
              {o.deadline ? displayDate(o.deadline) : 'Deadline not provided'}
            </div>
            {o.deadline && <div className="text-xs text-slate mb-4">Deadline to apply</div>}
            {o.link ? <TrackedExternalLink
              href={o.link}
              contentType="opportunity"
              contentId={o.id}
              action="application_click"
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-purple-900 text-white text-sm py-3 rounded-lg hover:bg-purple-700"
            >
              View application →
            </TrackedExternalLink> : <div className="text-sm text-slate mt-3">Application link not provided.</div>}
          </SideCard>

          {o.deadline && <SideCard title="Deadline reminder" className="opportunity-side-card">
            <CalendarActions
              id={o.id}
              contentType="opportunity"
              title={'Deadline: ' + o.title}
              date={o.deadline}
              location={o.location}
              description={'Application deadline for ' + o.title + ' from ' + o.org + '.'}
              url={o.link}
              kind="deadline"
            />
          </SideCard>}

          <SideCard title={isPvamuContact ? 'PVAMU Contact' : 'Organization contact'} className="opportunity-side-card">
            {o.contact_name && <div className="text-sm font-medium">{o.contact_name}</div>}
            {o.contact_title && <div className="text-xs text-slate mt-1">{o.contact_title}</div>}
            {o.contact_email && <a href={`mailto:${o.contact_email}`} className="text-sm text-purple-700 block mt-1 hover:underline">
              {o.contact_email}
            </a>}
            {!o.contact_name && !o.contact_email && <div className="text-sm text-slate">Contact information not provided.</div>}
            {o.contact_context && <div className="text-xs text-slate mt-2">{o.contact_context}</div>}
            {o.contact_linkedin && (
              <a href={o.contact_linkedin} target="_blank" rel="noreferrer" className="text-sm text-purple-700 block mt-1 hover:underline">
                Connect on LinkedIn
              </a>
            )}
          </SideCard>

          {o.source_url && o.source_url !== o.link && (
            <SideCard title="Official source" className="opportunity-side-card">
              <TrackedExternalLink contentType="opportunity" contentId={o.id} action="source_click" href={o.source_url} target="_blank" rel="noreferrer" className="text-sm text-purple-700 hover:underline">
                {o.source_name || 'View source'} →
              </TrackedExternalLink>
            </SideCard>
          )}

          {o.flyer_url && (
            <SideCard title="Original flyer" className="opportunity-side-card">
              <TrackedExternalLink contentType="opportunity" contentId={o.id} action="source_click" href={o.flyer_url} target="_blank" rel="noreferrer" className="block group">
                <img
                  src={o.flyer_url}
                  alt="Original flyer"
                  className="w-full rounded-lg border border-line group-hover:border-gold-400"
                />
                <span className="text-xs text-purple-700 mt-2 inline-block group-hover:underline">
                  View original flyer →
                </span>
              </TrackedExternalLink>
            </SideCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="font-mono text-xs uppercase tracking-wide text-slate mb-2">{title}</h3>
      {children}
    </div>
  );
}

function SideCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-line rounded-2xl p-6 mb-4 ${className}`}>
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-slate mb-4">{title}</h3>
      {children}
    </div>
  );
}
