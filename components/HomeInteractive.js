'use client';
import { useEffect, useState } from 'react';

export function DeadlineCountdown({ deadline }) {
  const calculate = () => {
    const remaining = Math.max(0, new Date(deadline).getTime() - Date.now());
    return {
      days: Math.floor(remaining / 86400000),
      hours: Math.floor((remaining % 86400000) / 3600000),
      minutes: Math.floor((remaining % 3600000) / 60000),
    };
  };
  const [time, setTime] = useState(calculate);
  useEffect(() => {
    const timer = setInterval(() => setTime(calculate()), 60000);
    return () => clearInterval(timer);
  }, [deadline]);
  return <div className="home-countdown" aria-label={time.days + ' days ' + time.hours + ' hours remaining'}>
    <Metric value={time.days} label="Days" /><Metric value={time.hours} label="Hrs" /><Metric value={time.minutes} label="Min" />
  </div>;
}
function Metric({ value, label }) {
  return <span><strong>{String(value).padStart(2, '0')}</strong><small>{label}</small></span>;
}

export function RotatingQuotes({ quotes }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (quotes.length < 2) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % quotes.length), 8000);
    return () => clearInterval(timer);
  }, [quotes.length]);
  const quote = quotes[index];
  return <figure className="legacy-quote">
    <blockquote>“{quote.text}”</blockquote>
    <figcaption>{quote.author}</figcaption>
    {quotes.length > 1 && <div className="quote-dots">{quotes.map((_, i) => <button key={i} aria-label={'Show quote ' + (i + 1)} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} />)}</div>}
  </figure>;
}
