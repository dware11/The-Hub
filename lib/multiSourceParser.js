import { parseFlyer } from './flyerParser';

export const PARSER_SCHEMA_VERSION = '1.0';
export const LOCAL_PARSER_VERSION = 'panther-local-2026-08-16';

const SOURCE_PRIORITY = Object.freeze({
  flyer: 100,
  program_pdf: 100,
  source_link: 90,
  email_screenshot: 60,
  screenshot: 55,
  pasted_text: 50,
  other: 40,
});

const MAJOR_PATTERNS = [
  ['Information Technology', /information technology|\bIT\b/i],
  ['Chemical Engineering', /chemical engineering/i],
  ['Civil Engineering', /civil engineering/i],
  ['Computer Science', /computer science|\bcs\b/i],
  ['Computer Engineering', /computer engineering|\bcpe\b/i],
  ['Cybersecurity', /cybersecurity|cyber security/i],
  ['Data Analytics', /data analytics/i],
  ['Electrical Engineering', /electrical engineering|\bee\b/i],
  ['Mechanical Engineering', /mechanical engineering/i],
];

const CATEGORY_PATTERNS = [
  ['Internship', /intern(ship)?\b/i],
  ['Co-op', /\bco-?op\b/i],
  ['Research', /research/i],
  ['Fellowship', /fellowship/i],
  ['Scholarship', /scholarship/i],
  ['Career fair', /career fair/i],
  ['Workshop', /workshop|training/i],
  ['Competition', /competition|hackathon/i],
  ['Org meeting', /chapter meeting|organization meeting/i],
];

const SECTOR_PATTERNS = [
  ['Artificial intelligence/data', /artificial intelligence|\bAI\b|machine learning|data science/i],
  ['Technology/software', /software|technology|\btech\b|computing|developer/i],
  ['Energy/oil and gas', /conocophillips|energy|oil and gas|petroleum/i],
  ['Healthcare/biomedical', /healthcare|biomedical|medical device/i],
  ['Automotive/mobility', /automotive|mobility|vehicle/i],
  ['Aerospace/defense', /aerospace|defense|aviation/i],
  ['Education/nonprofit', /education|nonprofit/i],
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function classify(text, patterns) {
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
}

function artifactPriority(artifact) {
  return SOURCE_PRIORITY[artifact.sourceType] || 0;
}

const HEURISTIC_REVIEW_FIELDS = new Set(['title', 'organization', 'description', 'eligibility', 'contactName']);

function fieldCandidate(artifact, field, value, parsed, sourceText = '') {
  const confidence = Number.isFinite(parsed.confidence) ? Math.round(parsed.confidence) : null;
  const needsReview = HEURISTIC_REVIEW_FIELDS.has(field)
    || (['image', 'pdf-ocr'].includes(parsed.source) && confidence < 80);
  return {
    field,
    value,
    sourceArtifactId: artifact.id,
    sourceType: artifact.sourceType,
    sourceName: artifact.name,
    sourceText,
    priority: artifactPriority(artifact),
    provider: 'local',
    parserVersion: LOCAL_PARSER_VERSION,
    confidence,
    needsReview,
    reviewReason: HEURISTIC_REVIEW_FIELDS.has(field)
      ? 'This value was inferred from document layout or surrounding text.'
      : needsReview ? 'The source text had lower OCR confidence.' : '',
  };
}

const MAX_PDF_TEXT_PAGES = 8;
const MAX_PDF_OCR_PAGES = 3;

async function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PDF page rendering failed.')), 'image/png'));
}

function pdfItemsToLines(items) {
  const lines = [];
  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) < 2.5);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, text });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '))
    .join('\n');
}

function pdfTextLooksUsable(text) {
  const tokens = text.match(/[A-Za-z]+/g) || [];
  const substantialWords = tokens.filter((token) => token.length >= 3);
  return text.length >= 80
    && substantialWords.length >= 8
    && substantialWords.length / Math.max(1, tokens.length) >= 0.4;
}

async function parsePdfSource(file, contentType, onProgress) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const textPages = Math.min(document.numPages, MAX_PDF_TEXT_PAGES);
  const extractedPages = [];
  const extractedLinks = [];

  for (let pageNumber = 1; pageNumber <= textPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    extractedPages.push(pdfItemsToLines(content.items));
    const annotations = await page.getAnnotations({ intent: 'display' });
    for (const annotation of annotations) {
      const url = annotation.url || annotation.unsafeUrl;
      if (/^https?:\/\//i.test(url || '')) extractedLinks.push(url);
    }
    onProgress?.((pageNumber / textPages) * 0.35);
  }

  let rawText = extractedPages.join('\n').trim();
  let source = 'pdf-text';
  let confidence = pdfTextLooksUsable(rawText) ? 100 : 0;
  let processedPages = textPages;

  if (!confidence) {
    const ocrPages = Math.min(document.numPages, MAX_PDF_OCR_PAGES);
    const ocrText = [];
    const confidences = [];
    for (let pageNumber = 1; pageNumber <= ocrPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise;
      const pageImage = await canvasBlob(canvas);
      const parsedPage = await parseFlyer({
        imageFile: pageImage,
        contentType,
        onProgress: (progress) => onProgress?.(0.35 + ((pageNumber - 1 + progress) / ocrPages) * 0.65),
      });
      ocrText.push(parsedPage.rawText);
      if (parsedPage.fields.link) extractedLinks.push(parsedPage.fields.link);
      confidences.push(parsedPage.confidence);
    }
    rawText = ocrText.join('\n').trim();
    source = 'pdf-ocr';
    confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0;
    processedPages = ocrPages;
  }

  const parsed = await parseFlyer({ text: rawText, contentType });
  const links = unique(extractedLinks);
  if (!parsed.fields.link && links.length) {
    parsed.fields.link = links.find((url) => !/linkedin|instagram|facebook|youtube/i.test(url)) || links[0];
    parsed.detected.link = true;
  }
  return {
    ...parsed,
    source,
    confidence,
    pdf: { pageCount: document.numPages, processedPages },
  };
}

export async function parseMultipleSources({ contentType, artifacts, pastedText, onProgress }) {
  const processed = [];
  const warnings = [];
  const candidates = {};
  const allText = [];

  const sources = [...artifacts];
  if (pastedText?.trim()) {
    sources.push({
      id: 'pasted-text',
      sourceType: 'pasted_text',
      name: 'Pasted text',
      text: pastedText.trim(),
    });
  }

  for (let index = 0; index < sources.length; index += 1) {
    const artifact = sources[index];
    onProgress?.({ index, total: sources.length, source: artifact.name, progress: 0 });

    try {
      const parsed = artifact.file?.type === 'application/pdf'
        ? await parsePdfSource(artifact.file, contentType, (progress) =>
            onProgress?.({ index, total: sources.length, source: artifact.name, progress }))
        : artifact.text
          ? await parseFlyer({ text: artifact.text, contentType })
          : await parseFlyer({
            imageFile: artifact.file,
            contentType,
            onProgress: (progress) =>
              onProgress?.({ index, total: sources.length, source: artifact.name, progress }),
          });

      allText.push(parsed.rawText);
      processed.push({
        artifactId: artifact.id,
        sourceType: artifact.sourceType,
        sourceName: artifact.name,
        status: 'processed',
        rawText: parsed.rawText,
        confidence: parsed.confidence,
      });

      if (!parsed.rawText.trim() || (['image', 'pdf-ocr'].includes(parsed.source) && parsed.confidence < 45)) {
        warnings.push({
          code: 'OCR_REVIEW_NEEDED',
          artifactId: artifact.id,
          message: `${artifact.name} produced ${parsed.rawText.trim() ? 'low-confidence' : 'no'} readable text. Try a tighter screenshot with clear text, or enter the missing details manually.`,
        });
      }

      for (const [field, value] of Object.entries(parsed.fields)) {
        if (!value) continue;
        (candidates[field] ||= []).push(fieldCandidate(artifact, field, value, parsed));
      }
    } catch {
      processed.push({
        artifactId: artifact.id,
        sourceType: artifact.sourceType,
        sourceName: artifact.name,
        status: 'failed',
        rawText: '',
      });
      warnings.push({
        code: 'SOURCE_PROCESSING_FAILED',
        artifactId: artifact.id,
        message: `${artifact.name} could not be read automatically. You can continue with the other sources or enter the missing information manually.`,
      });
    }

    onProgress?.({ index, total: sources.length, source: artifact.name, progress: 1 });
  }

  const fields = {};
  const provenance = {};
  const conflicts = [];

  for (const [field, values] of Object.entries(candidates)) {
    const ranked = values.slice().sort((a, b) => b.priority - a.priority);
    fields[field] = ranked[0].value;
    provenance[field] = ranked[0];
    const alternatives = unique(ranked.map((candidate) => String(candidate.value).trim().toLowerCase()));
    if (alternatives.length > 1) {
      provenance[field] = {
        ...provenance[field],
        needsReview: true,
        reviewReason: 'Different sources produced different values for this field.',
      };
      conflicts.push({
        field,
        selected: ranked[0],
        alternatives: ranked.slice(1),
        message: `Different ${field} values were found. The flyer/program source is suggested first; verify newer official evidence before submission.`,
      });
    }
  }

  const combinedText = allText.join('\n');
  const tags = {
    categories: classify(combinedText, CATEGORY_PATTERNS),
    majors: classify(combinedText, MAJOR_PATTERNS),
    sectors: classify(combinedText, SECTOR_PATTERNS),
    paid: /\bpaid\b|salary|stipend|compensation|\$\s?\d/i.test(combinedText),
    compensation: /\bunpaid\b|uncompensated/i.test(combinedText)
      ? 'Unpaid'
      : /\bfunded\b|stipend|scholarship/i.test(combinedText)
        ? 'Funded'
        : /\bpaid\b|salary|compensation|\$\s?\d/i.test(combinedText) ? 'Paid' : 'Not specified',
    workModes: unique([
      /\bremote\b/i.test(combinedText) && 'Remote',
      /\bhybrid\b/i.test(combinedText) && 'Hybrid',
      /on[- ]?site|in person/i.test(combinedText) && 'In person',
    ]),
    classifications: unique([
      /\bfreshm(?:an|en)\b|first[- ]year/i.test(combinedText) && 'Freshman',
      /\bsophomore\b|second[- ]year/i.test(combinedText) && 'Sophomore',
      /\bjunior\b|third[- ]year/i.test(combinedText) && 'Junior',
      /\bsenior\b|fourth[- ]year/i.test(combinedText) && 'Senior',
      /graduate students?|graduate-level|master'?s|doctoral|ph\.?d\.?/i.test(combinedText) && 'Graduate',
    ]),
    qualifications: unique([
      /work authorization|authorized to work/i.test(combinedText) && 'Work authorization required',
      /no degree/i.test(combinedText) && 'No degree required',
      /no coding experience/i.test(combinedText) && 'No coding experience required',
      /undergraduate/i.test(combinedText) && 'Undergraduate',
      /graduate students?|graduate-level/i.test(combinedText) && 'Graduate',
    ]),
  };

  if (contentType === 'event' && !fields.date && fields.deadline) {
    fields.date = fields.deadline;
    provenance.date = provenance.deadline;
    warnings.push({
      code: 'EVENT_DATE_INFERRED',
      message: 'A date was found without a clear event/deadline label. Confirm that it is the event date.',
    });
  }


  if (contentType === 'event') {
    const dateMentions = combinedText.match(new RegExp(`\\b(?:${'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'})\\.?\\s+\\d{1,2}`, 'gi')) || [];
    const distinctDates = unique(dateMentions.map((value) => value.toLowerCase().replace(/\\s+/g, ' ')));
    if (distinctDates.length > 1) {
      warnings.push({
        code: 'MULTIPLE_EVENTS_DETECTED',
        message: `This source appears to contain ${distinctDates.length} or more event dates. Automatic extraction suggests only the first event; create and verify a separate record for each event before publishing.`,
      });
    }
  }

  const uncertainFields = Object.entries(provenance)
    .filter(([, suggestion]) => suggestion.needsReview)
    .map(([field, suggestion]) => ({
      field,
      sourceName: suggestion.sourceName,
      reason: suggestion.reviewReason || 'Confirm this extracted value before submitting.',
    }));

  return {
    schemaVersion: PARSER_SCHEMA_VERSION,
    parser: { provider: 'local', version: LOCAL_PARSER_VERSION },
    source: { artifactCount: sources.length, processed },
    rawText: combinedText,
    fields,
    provenance,
    conflicts,
    tags,
    warnings,
    uncertainFields,
    processing: { completedAt: new Date().toISOString() },
  };
}
