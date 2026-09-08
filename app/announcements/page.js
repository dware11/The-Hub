import { getAnnouncements } from '../../lib/data';
import EngagementTracker from '../../components/EngagementTracker';
import AnnouncementsBrowser from '../../components/AnnouncementsBrowser';
export const metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const items = await getAnnouncements();
  return <div className="page-wrap announcement-editorial"><EngagementTracker contentType="announcement" contentId="announcements-index" action="list_view" /><header className="announcement-intro"><div className="eyebrow">Announcements</div><h1>Stay informed. Stay <em>connected.</em></h1><p>Important updates, news, and notices from the Roy G. Perry College of Engineering and the engineering community.</p></header><AnnouncementsBrowser items={items} /></div>;
}
