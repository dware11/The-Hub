import { getOpportunities } from '../../lib/data';
import OpportunitiesBrowser from '../../components/OpportunitiesBrowser';
export const metadata = { title: 'Opportunities' };

export default async function OpportunitiesPage() {
  const items = await getOpportunities();
  return (
    <div className="page-wrap">
      <header className="page-head editorial-intro">
        <div className="eyebrow">Opportunities</div>
        <h1>Find what moves you forward.</h1>
        <p>Filter verified internships, research, scholarships, co-ops, competitions, and graduate pathways by the details that matter to you.</p>
      </header>
      <OpportunitiesBrowser items={items} />
    </div>
  );
}
