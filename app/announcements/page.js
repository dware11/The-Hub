import { getAnnouncements } from '../../lib/data';

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements();

  return (
    <div className="pb-16">
      <div className="mt-9 mb-2">
        <h1 className="font-display text-2xl text-purple-900">Announcements</h1>
        <div className="text-sm text-slate mt-1">
          Official posts from verified contributors across the college
        </div>
      </div>
      <div className="text-xs text-slate mb-6">
        Every Monday, the top picks go out from{' '}
        <span className="font-mono text-purple-700">code@pvamu.edu</span> — everything else lives here.
      </div>

      <div className="flex flex-col gap-3">
        {announcements.map((a) => (
          <div
            key={a.id}
            className={`bg-white border border-line rounded-lg px-5 py-4 ${
              a.pinned ? 'border-l-4 border-l-gold-600' : ''
            }`}
          >
            <div className="flex justify-between items-center mb-2 flex-wrap gap-1">
              <span className="font-mono text-[10px] uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                {a.source}
              </span>
              <span className="font-mono text-xs text-slate">
                {new Date(a.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="font-display font-semibold mb-1">{a.title}</div>
            <div className="text-sm text-ink/80">{a.body}</div>
            {a.emailed_this_week && (
              <div className="mt-2 font-mono text-[10px] text-gold-600">✉ Sent in this week's email</div>
            )}
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="text-sm text-slate py-12 text-center">No announcements posted yet.</div>
        )}
      </div>
    </div>
  );
}
