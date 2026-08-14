import Link from 'next/link';

const PILLARS = [
  ['01', 'Student voice', 'Town halls and reports turn student concerns into action.'],
  ['02', 'Coordination', 'Organizations, ambassadors and departments align their efforts.'],
  ['03', 'The Hub', 'One dependable place for internships, research, events and updates.'],
  ['04', 'Partnerships', 'Alumni, sponsors and industry partners have one point of contact.'],
];

export default function AboutPage() {
  return <div className="about-page">
    <header className="about-hero">
      <div className="eyebrow">About C.O.D.E.</div>
      <h1>More than announcements. <em>A bridge for Panther engineers.</em></h1>
      <p>C.O.D.E. connects Prairie View A&amp;M University's College of Engineering through one dependable place for opportunities, coordination and student voice.</p>
    </header>
    <section className="pillars-row">
      {PILLARS.map(([number,title,body]) => <article className="pillar" key={number}><div className="pillar-index">{number}</div><h2>{title}</h2><p>{body}</p></article>)}
    </section>
    <section className="about-ethos">
      <img src="/code-crest.png" alt="" className="ethos-crest" />
      <div className="eyebrow">Our ethos</div>
      <blockquote>Excellence is not built alone.<br />It is engineered together.</blockquote>
      <p>Council of Distinguished Engineers<span>Prairie View A&amp;M University • College of Engineering</span></p>
      <div className="ethos-actions"><Link href="/opportunities" className="gold-button">Explore opportunities</Link><Link href="/panther-submit" className="outline-button">Submit an opportunity</Link></div>
    </section>
  </div>;
}
