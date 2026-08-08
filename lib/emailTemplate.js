// Builds the weekly digest HTML. Email clients don't reliably support
// external stylesheets or web fonts, so everything here is inline and
// falls back to system fonts -- the mono-for-data-points convention is
// kept using a generic monospace stack instead of IBM Plex Mono.
const PURPLE = '#241748';
const GOLD = '#D4AF37';
const CORAL = '#B8562F';
const SLATE = '#6B6875';
const LINE = '#E7E2EF';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildDigestEmail({ opportunities, events, announcements, siteUrl }) {
  const row = (label, title, meta, href) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid ${LINE};">
        <div style="font-family:monospace;font-size:11px;color:${CORAL};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">${label}</div>
        <a href="${href}" style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:${PURPLE};text-decoration:none;">${title}</a>
        <div style="font-size:12px;color:${SLATE};margin-top:2px;">${meta}</div>
      </td>
    </tr>`;

  const oppRows = opportunities
    .map((o) => row(`Closes ${fmtDate(o.deadline)}`, o.title, o.org, `${siteUrl}/opportunities/${o.id}`))
    .join('');
  const eventRows = events
    .map((e) => row(fmtDate(e.date), e.title, `${e.location}${e.time ? ' · ' + e.time : ''}`, `${siteUrl}/events/${e.id}`))
    .join('');
  const annRows = announcements
    .map((a) => row(a.source, a.title, a.body.slice(0, 90), `${siteUrl}/announcements`))
    .join('');

  const section = (heading, rows) =>
    rows
      ? `<tr><td style="padding:24px 0 4px;font-family:monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${GOLD};border-top:2px solid ${PURPLE};padding-top:16px;">${heading}</td></tr><tr><td><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`
      : '';

  return `<!doctype html>
<html>
  <body style="margin:0;background:#FBFAF8;font-family:Helvetica,Arial,sans-serif;color:#18151F;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <tr>
        <td style="padding-bottom:20px;">
          <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:${PURPLE};">C.O.D.E. Engineering Hub</div>
          <div style="font-family:monospace;font-size:11px;color:${SLATE};">THIS WEEK · Roy G. Perry College of Engineering</div>
        </td>
      </tr>
      ${section('Closing soon', oppRows)}
      ${section('Upcoming events', eventRows)}
      ${section('Announcements', annRows)}
      <tr>
        <td style="padding-top:28px;">
          <a href="${siteUrl}" style="display:inline-block;background:${PURPLE};color:#fff;text-decoration:none;font-size:13px;padding:10px 18px;border-radius:8px;">
            View the full Hub →
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
