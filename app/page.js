import Link from 'next/link';
import Image from 'next/image';
import { getOpportunities, getEvents, getAnnouncements } from '../lib/data';
import { RotatingQuotes } from '../components/HomeInteractive';
import HomeSpotlightCarousel from '../components/HomeSpotlightCarousel';
import { isClosingThisWeek } from '../lib/dateFilters';

const QUOTES = [{ text: 'Excellence lives at Prairie View A&M University. It always has. It always will.', author: 'Dr. Tomikia P. LeGrande · President, Prairie View A&M University' }];
const localDate = value => new Date(`${value}T12:00:00`);
const publishedDate = item => new Date(item.published_at || item.created_at);

export default async function HomePage() {
  const [opportunities, events, announcements] = await Promise.all([getOpportunities(), getEvents(), getAnnouncements()]);
  const today = new Date();
  const open = opportunities.filter(item => !item.deadline || localDate(item.deadline) >= today);
  const spotlight = [
    ...open.filter(item => item.is_featured || item.spotlight || item.featured).map(item => ({ ...item, contentType: 'opportunity', href: `/opportunities/${item.id}` })),
    ...events.filter(item => (item.is_featured || item.spotlight || item.featured) && localDate(item.end_date || item.date) >= today).map(item => ({ ...item, contentType: 'event', href: `/events/${item.id}` })),
    ...announcements.filter(item => item.is_featured).map(item => ({ ...item, contentType: 'announcement', href: `/announcements/${item.id}` })),
  ].sort((a,b) => (a.spotlight_rank || 99) - (b.spotlight_rank || 99)).slice(0,5);
  const closing = open.filter(item => item.deadline && isClosingThisWeek(item.deadline, today)).sort((a,b) => localDate(a.deadline) - localDate(b.deadline)).slice(0,4);
  const upcoming = events.filter(item => item.home_visible !== false && localDate(item.end_date || item.date) >= today).sort((a,b) => (a.home_rank || 99) - (b.home_rank || 99) || localDate(a.date) - localDate(b.date)).slice(0,4);
  const latestAnnouncements = [...announcements].filter(item => !/engineering hub pilot is live/i.test(item.title || '')).sort((a,b) => publishedDate(b) - publishedDate(a)).slice(0,4);

  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-photo" aria-hidden="true"><Image src="/images/pvamu-encarb-hero.jpg" alt="" fill priority sizes="100vw" /></div>
      <div className="home-hero-photo-overlay" aria-hidden="true" />
      <div className="home-hero-copy"><div className="home-institution"><span>Prairie View A&amp;M University</span><strong>Roy G. Perry College of Engineering</strong></div><h1>Excellence finds every <em>Panther</em> here.</h1><p>Discover opportunities, events, resources, and connections created for PVAMU engineers.</p><div className="hero-actions"><Link href="/opportunities" className="home-hero-action">Explore Opportunities</Link><Link href="/events" className="home-hero-action">View Events</Link><Link href="/panther-submit" className="home-hero-action">Submit to the Hub</Link></div></div>
    </section>

    <section className="home-spotlight-section" aria-labelledby="home-spotlight-title"><div className="home-section-heading"><div className="eyebrow">Spotlight</div><h2 id="home-spotlight-title">Featured for PVAMU engineers</h2></div><HomeSpotlightCarousel items={spotlight} /></section>

    <section className="home-editorial-grid">
      <div className="home-editorial-column"><SectionHead title="Closing This Week" subtitle="Opportunities with upcoming deadlines." href="/opportunities" />{closing.length ? <div className="home-editorial-rows">{closing.map(item => <Link href={`/opportunities/${item.id}`} key={item.id}><span><strong>{item.title}</strong><small>{item.org}</small></span><time>{localDate(item.deadline).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</time><b aria-hidden="true">→</b></Link>)}</div> : <p className="home-empty-row">No opportunities are closing this week.</p>}</div>
      <div className="home-editorial-column"><SectionHead title="Latest Announcements" subtitle="Stay informed with the latest updates." href="/announcements" />{latestAnnouncements.length ? <div className="home-editorial-rows">{latestAnnouncements.map(item => <Link href={`/announcements/${item.id}`} key={item.id}><span><strong>{item.title}</strong><small>{item.source}</small></span><time>{publishedDate(item).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</time><b aria-hidden="true">→</b></Link>)}</div> : <p className="home-empty-row">No announcements are available.</p>}</div>
    </section>

    <section className="home-events-section"><div className="home-events-inner"><SectionHead title="Upcoming Events" subtitle="Workshops, information sessions, and events for PVAMU engineers." href="/events" label="View All Events →" inverse />{upcoming.length ? <div className="home-event-grid">{upcoming.map(item => <Link href={`/events/${item.id}`} key={item.id}><time><span>{localDate(item.date).toLocaleDateString('en-US',{month:'short'})}</span><strong>{localDate(item.date).getDate()}</strong></time><div><h3>{item.title}</h3><p>{item.org}</p>{item.time && <small>{item.time}</small>}{item.location && <small>{item.location}</small>}<b>View Event →</b></div></Link>)}</div> : <p>No upcoming events are currently published.</p>}</div></section>

    <RotatingQuotes quotes={QUOTES} />
  </div>;
}

function SectionHead({title,subtitle,href,label='View All →',inverse=false}) { return <div className={`home-list-heading${inverse?' inverse':''}`}><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><Link href={href}>{label}</Link></div>; }
