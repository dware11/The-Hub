// Flyer/paste-text field extraction.
//
// This module has ONE public entry point, `parseFlyer`, with a fixed
// contract:
//
//   input:  { text?: string, imageFile?: File }
//   output: Promise<{
//     rawText: string,
//     source: 'text' | 'image',
//     fields: {
//       title, date, time, deadline, location,
//       contactName, contactEmail, link,
//       presenterName, presenterAffiliation
//     },
//     detected: { <same keys>: boolean }   // true = confidently extracted
//   }>
//
// Today this is regex/keyword pattern matching over OCR'd or pasted text
// (Tesseract.js does the OCR -- free, no API key). If that turns out to be
// too unreliable on real flyers, the upgrade path is swapping the body of
// `parseFlyer` for a single vision-capable LLM API call (Claude Haiku or
// Gemini Flash-Lite, whichever is cheaper at the time) that returns the
// same `fields` shape -- nothing outside this file needs to change.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /\bhttps?:\/\/[^\s,)]+|(?<![@\w])www\.[^\s,)]+/gi;
const TIME_RE = /\b\d{1,2}(:\d{2})?\s?(AM|PM|am|pm)\b(\s?[–—-]\s?\d{1,2}(:\d{2})?\s?(AM|PM|am|pm)\b)?/;

const MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const DATE_RE_WORD = new RegExp(`\\b(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?\\b`, 'i');
const DATE_RE_NUMERIC = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;

const LOCATION_KEYWORDS = /^(location|where|venue)\s*[:\-]\s*(.+)/i;
const DEADLINE_KEYWORDS = /(deadline|due|apply by|rsvp by|register by|closes?)\s*[:\-]?\s*(.+)/i;
const TIME_KEYWORDS = /^(time|when)\s*[:\-]\s*(.+)/i;
const PRESENTER_KEYWORDS = /(presenter|speaker|featuring|guest)\s*[:\-]?\s*(.+)/i;
const ROOM_HINT = /\b(rm|room|bldg|building|hall|lab|auditorium|center|floor)\b/i;

function currentYearIfMissing(match) {
  if (!match) return null;
  if (match[3]) return `${match[1]} ${match[2]}, ${match[3]}`;
  const now = new Date();
  return `${match[1]} ${match[2]}, ${now.getFullYear()}`;
}

function findAllDates(text) {
  const found = [];
  const wordRe = new RegExp(DATE_RE_WORD, 'gi');
  let m;
  while ((m = wordRe.exec(text))) {
    const parsed = new Date(currentYearIfMissing([m[0], m[1], m[2], m[3]]));
    if (!isNaN(parsed)) found.push({ index: m.index, raw: m[0], date: parsed });
  }
  const numRe = new RegExp(DATE_RE_NUMERIC, 'g');
  while ((m = numRe.exec(text))) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const parsed = new Date(`${m[1]}/${m[2]}/${year}`);
    if (!isNaN(parsed)) found.push({ index: m.index, raw: m[0], date: parsed });
  }
  return found.sort((a, b) => a.index - b.index);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Pure, synchronous field extraction over already-known text (pasted
// directly, or the output of OCR). Exported separately so it can be unit
// tested / reused without touching Tesseract at all.
export function extractFieldsFromText(rawText) {
  const text = (rawText || '').trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const fields = {
    title: '',
    date: '',
    time: '',
    deadline: '',
    location: '',
    contactName: '',
    contactEmail: '',
    link: '',
    presenterName: '',
    presenterAffiliation: '',
  };
  const detected = Object.fromEntries(Object.keys(fields).map((k) => [k, false]));

  // Title: first substantial line, skipping obvious label lines.
  const titleLine = lines.find((l) => l.length > 3 && !/^(date|time|location|deadline|contact)\b/i.test(l));
  if (titleLine) {
    fields.title = titleLine.replace(/[.:]+$/, '');
    detected.title = true;
  }

  // Emails.
  const emails = [...text.matchAll(EMAIL_RE)].map((m) => m[0]);
  if (emails.length) {
    const pvamu = emails.find((e) => e.toLowerCase().endsWith('@pvamu.edu'));
    fields.contactEmail = pvamu || emails[0];
    detected.contactEmail = true;
    // Contact name: text right before the email on its line, minus a trailing comma.
    const emailLine = lines.find((l) => l.includes(fields.contactEmail));
    if (emailLine) {
      const before = emailLine
        .split(fields.contactEmail)[0]
        .replace(/[,\-–]+\s*$/, '')
        .replace(/^questions\??\s*/i, '')
        .trim();
      if (before && before.length < 40) {
        fields.contactName = before;
        detected.contactName = true;
      }
    }
  }

  // Links (registration / application), excluding email addresses.
  const urls = [...text.matchAll(URL_RE)].map((m) => m[0]).filter((u) => !u.includes('@'));
  if (urls.length) {
    fields.link = urls[0];
    detected.link = true;
  }

  // Explicit "Location:" / "Where:" label wins; otherwise fall back to a
  // line that looks like a room/building reference.
  const locationLabelLine = lines.map((l) => l.match(LOCATION_KEYWORDS)).find(Boolean);
  if (locationLabelLine) {
    fields.location = locationLabelLine[2].trim();
    detected.location = true;
  } else {
    const roomLine = lines.find((l) => ROOM_HINT.test(l) && l.length < 60);
    if (roomLine) {
      fields.location = roomLine.trim();
      detected.location = true;
    }
  }

  // Deadline: explicit "Deadline:"/"Apply by:" label, else unused if no
  // such label is present (kept blank rather than guessed).
  const deadlineLabelLine = lines.map((l) => l.match(DEADLINE_KEYWORDS)).find(Boolean);
  if (deadlineLabelLine) {
    const dates = findAllDates(deadlineLabelLine[2]);
    if (dates.length) {
      fields.deadline = toISODate(dates[0].date);
      detected.deadline = true;
    }
  }

  // Time: explicit "Time:" label, else the first time-looking token found.
  const timeLabelLine = lines.map((l) => l.match(TIME_KEYWORDS)).find(Boolean);
  const timeMatch = timeLabelLine ? timeLabelLine[2].match(TIME_RE) : text.match(TIME_RE);
  if (timeMatch) {
    fields.time = timeMatch[0].replace(/\s?[–—]\s?/, ' – ');
    detected.time = true;
  }

  // Date: all dates found in the doc; the deadline (if any) is excluded so
  // the event/occurring date doesn't collide with it.
  const allDates = findAllDates(text);
  const nonDeadlineDate = allDates.find((d) => toISODate(d.date) !== fields.deadline);
  if (nonDeadlineDate) {
    fields.date = toISODate(nonDeadlineDate.date);
    detected.date = true;
  } else if (!fields.deadline && allDates.length) {
    fields.deadline = toISODate(allDates[0].date);
    detected.deadline = true;
  }

  // Presenter.
  const presenterLine = lines.map((l) => l.match(PRESENTER_KEYWORDS)).find(Boolean);
  if (presenterLine) {
    const [name, affiliation] = presenterLine[2].split(/[·,]/).map((s) => s && s.trim());
    if (name) {
      fields.presenterName = name;
      detected.presenterName = true;
    }
    if (affiliation) {
      fields.presenterAffiliation = affiliation;
      detected.presenterAffiliation = true;
    }
  }

  return { fields, detected };
}

// Runs Tesseract.js OCR on an uploaded image/screenshot/PDF-page and
// returns the raw recognized text. Lazily imports tesseract.js so it never
// hits the server bundle -- this only ever runs in the browser, from the
// submit form.
export async function runOCR(imageFile, onProgress) {
  const { default: Tesseract } = await import('tesseract.js');
  const {
    data: { text },
  } = await Tesseract.recognize(imageFile, 'eng', {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  return text;
}

// The single fixed-contract entry point described at the top of this file.
export async function parseFlyer({ text, imageFile, onProgress }) {
  let rawText = text || '';
  let source = 'text';

  if (imageFile && !text) {
    rawText = await runOCR(imageFile, onProgress);
    source = 'image';
  }

  const { fields, detected } = extractFieldsFromText(rawText);
  return { rawText, source, fields, detected };
}
