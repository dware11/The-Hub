import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAnnouncement } from '../../../lib/data';
import { announcementCategory } from '../../../lib/announcementCategories';
import EngagementTracker from '../../../components/EngagementTracker';

export default async function AnnouncementDetailPage({ params }) {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();
  const published = announcement.published_at || announcement.created_at;
  return <article className="page-wrap announcement-detail"><EngagementTracker contentType="announcement" contentId={announcement.id} action="detail_view" /><Link className="announcement-back" href="/announcements">← All announcements</Link><header><span className="announcement-category-pill">{announcementCategory(announcement.category)}</span><h1>{announcement.title}</h1><p className="announcement-detail-meta">Published by <strong>{announcement.source}</strong>{published ? <> · <time dateTime={published}>{new Date(published).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time></> : null}</p></header><div className="announcement-detail-body">{announcement.body.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{announcement.source_url && <a className="announcement-source-action" href={announcement.source_url} target="_blank" rel="noreferrer">Visit official source <span aria-hidden="true">↗</span></a>}</article>;
}
