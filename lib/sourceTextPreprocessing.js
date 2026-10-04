const RECOMMENDATION_HEADING = /^(?:Similar Jobs?|Related Jobs?|Recommended Jobs?|People also viewed)(?:\s*\(|\b)/i;
const LEADING_CHROME = new Set([
  'skip to main content',
  'sign in',
  'home',
  'search for jobs',
]);

function lines(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function jobBoardSourceHints(value) {
  const sourceLines = lines(value);
  const loadedLine = sourceLines.find((line) => /\s+page is loaded$/i.test(line));
  const title = loadedLine?.replace(/\s+page is loaded$/i, '').trim() || null;
  const organization = sourceLines
    .map((line) => line.match(/^CAREERS AT\s+(.+)$/i)?.[1]?.trim())
    .find(Boolean) || null;
  const sourceUrl = sourceLines
    .map((line) => line.match(/^Official source URL:\s*(https?:\/\/\S+)$/i)?.[1])
    .find(Boolean) || null;
  return { title, organization, sourceUrl };
}

export function prepareSourceTextForExtraction(value) {
  const sourceLines = lines(value);
  if (!sourceLines.length) return '';

  const hints = jobBoardSourceHints(value);
  const loadedIndex = sourceLines.findIndex((line) => /\s+page is loaded$/i.test(line));
  let prepared = loadedIndex >= 0 ? sourceLines.slice(loadedIndex + 1) : [...sourceLines];

  if (hints.title) {
    if (prepared[0]?.toLowerCase() === hints.title.toLowerCase()) prepared.shift();
    prepared.unshift(hints.title);
  } else {
    while (prepared.length && LEADING_CHROME.has(prepared[0].toLowerCase())) prepared.shift();
  }

  const recommendationIndex = prepared.findIndex((line) => RECOMMENDATION_HEADING.test(line));
  if (recommendationIndex >= 0) prepared = prepared.slice(0, recommendationIndex);

  if (hints.organization) prepared.splice(1, 0, `Organization shown in source header: ${hints.organization}`);
  if (hints.sourceUrl) prepared.push(`Official source URL: ${hints.sourceUrl}`);

  return prepared.join('\n').slice(0, 50_000);
}
