import Link from 'next/link';
import { getOpportunities, getEvents, getAnnouncements } from '../lib/data';
import { DeadlineCountdown, RotatingQuotes } from '../components/HomeInteractive';

const QUOTES = [{ text: 'Excellence lives at Prairie View A&M University. It always has. It always will.', author: 'Dr. Tomikia P. LeGrande · President, Prairie View A&M University' }];

export default async function HomePage() {
  const [opportunities, events, announcements] = await Promise.all([getOpportunities(), getEvents(), getAnnouncements()]);
  const today = new Date();
  const open = opportunities.filter(item => new Date(item.deadline) >= today);
  const ranked = open.filter(item => item.spotlight || item.featured || item.spotlight_rank).sort((a,b) => (a.spotlight_rank || 99) - (b.spotlight_rank || 99));
  const byDeadline = [...open].sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
  const spotlight = ranked[0] || byDeadline[0];
  const closing = byDeadline.slice(0,3);
  const upcoming = [...events].filter(item => new Date(item.date) >= today).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0,3);
  return <div className="home-page">
    <div className="values-ribbon">Excellence ◆ Innovation ◆ Integrity ◆ Service ◆ Leadership</div>
    <section className="home-hero">
      <img src="/pvamu-crest.webp" className="pvamu-hero-crest" alt="" />
      <div className="home-hero-copy"><div className="eyebrow">Engineering opportunities, centralized</div><h1>Excellence finds every <em>Panther</em> here.</h1><p>Internships, research, scholarships, events, and trusted updates from across the College of Engineering—organized in one place.</p>
        <div className="home-metrics"><span><strong>{open.length}</strong><small>Open opportunities</small></span><span><strong>{upcoming.length}</strong><small>Upcoming events</small></span></div>
      </div>
      {spotlight && <aside className="spotlight"><div className="eyebrow">☆ Spotlight · Closing Soon</div><h2>{spotlight.title}</h2><p>{spotlight.org}</p><DeadlineCountdown deadline={spotlight.deadline} /><Link href={'/opportunities/'+spotlight.id} className="gold-button">View opportunity →</Link></aside>}
    </section>
    <section className="home-content">
      <div className="home-main">
        <SectionHead title="Closing this week" href="/opportunities" />
        <div className="closing-grid">{closing.map(item => <Link href={'/opportunities/'+item.id} className="closing-card" key={item.id}><div className="eyebrow">{item.type}{item.paid?' · Paid/Funded':''}</div><h3>{item.title}</h3><p>{item.org}</p><strong>Apply by {new Date(item.deadline).toLocaleDateString()}</strong></Link>)}</div>
        <SectionHead title="Upcoming events" href="/events" label="View calendar →" />
        <div className="upcoming-list">{upcoming.map(item => <Link href={'/events/'+item.id} key={item.id}><time>{new Date(item.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</time><span><strong>{item.title}</strong><small>{item.time} · {item.location}</small></span></Link>)}</div>
      </div>
      <aside className="announcement-panel"><SectionHead title="Announcements" href="/announcements" />{announcements.slice(0,3).map((item,i) => <article className={i===0?'featured-announcement':''} key={item.id}><div className="eyebrow">{item.source}</div><h3>{item.title}</h3>{i===0&&<p>{item.body}</p>}</article>)}</aside>
    </section>
    <RotatingQuotes quotes={QUOTES} />
  </div>;
}
function SectionHead({title,href,label='View all →'}) { return <div className="home-section-head"><h2>{title}</h2><Link href={href}>{label}</Link></div>; }
