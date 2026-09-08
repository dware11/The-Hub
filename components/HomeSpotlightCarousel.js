'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

const SPOTLIGHT_BANNER = '/images/spotlight-universal-engineering.png';

function meta(item) {
  if (item.contentType === 'opportunity') return [item.deadline && `Deadline ${new Date(item.deadline + 'T12:00:00').toLocaleDateString()}`, item.location, (item.majors || []).filter(value => value !== 'All majors').slice(0,2).join(', ')];
  if (item.contentType === 'event') return [item.date && new Date(item.date + 'T12:00:00').toLocaleDateString(), item.time, item.location];
  return [(item.published_at || item.created_at) && new Date(item.published_at || item.created_at).toLocaleDateString(), item.source];
}

export default function HomeSpotlightCarousel({ items }) {
  const [index,setIndex] = useState(0);
  if (!items.length) return <div className="home-spotlight-empty"><strong>Spotlight is being curated.</strong><span>Check back soon for a featured opportunity, event, or announcement.</span></div>;
  const item = items[index];
  const description = item.description || item.body;
  const label = item.contentType === 'announcement' ? 'Read Announcement' : `View ${item.contentType}`;
  const move = direction => setIndex(current => (current + direction + items.length) % items.length);
  return <article className="home-spotlight-card" aria-roledescription="carousel" aria-label="Home Spotlight">
    <div className="home-spotlight-copy"><div className="home-spotlight-type">{item.contentType}</div><h3>{item.title}</h3><strong>{item.org || item.source}</strong>{description&&<p>{description}</p>}<div className="home-spotlight-meta">{meta(item).filter(value => value && !['Other','Not specified'].includes(value)).map(value=><span key={value}>{value}</span>)}</div><Link href={item.href}>{label} <span aria-hidden="true">→</span></Link></div>
    <div className="home-spotlight-blueprint is-native-art"><div className="home-spotlight-image" aria-hidden="true"><Image src={SPOTLIGHT_BANNER} alt="" fill sizes="(max-width: 700px) 100vw, 45vw" priority /></div>{items.length>1&&<div className="home-spotlight-controls"><button type="button" onClick={()=>move(-1)} aria-label="Previous Spotlight item">←</button><span aria-live="polite">{index+1} / {items.length}</span><button type="button" onClick={()=>move(1)} aria-label="Next Spotlight item">→</button></div>}</div>
  </article>;
}
