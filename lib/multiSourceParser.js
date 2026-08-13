import { parseFlyer } from './flyerParser';

export const PARSER_SCHEMA_VERSION = '1.0';
export const LOCAL_PARSER_VERSION = 'panther-local-2026-08-13';

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
  ['Computer Science', /computer science|\bcs\b/i],
  ['Computer Engineering', /computer engineering|\bcpe\b/i],
  ['Electrical Engineering', /electrical engineering|\bee\b/i],
  ['Civil Engineering', /civil engineering/i],
  ['Mechanical Engineering', /mechanical engineering/i],
  ['Industrial Engineering', /industrial engineering/i],
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
  ['Technology/software', /software|technology|computing|developer/i],
  ['Energy/oil and gas', /energy|oil and gas|petroleum/i],
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

function fieldCandidate(artifact, field, value, sourceText = '') {
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
    needsReview: true,
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

    if (artifact.file?.type === 'application/pdf') {
      processed.push({
        artifactId: artifact.id,
        sourceType: artifact.sourceType,
        sourceName: artifact.name,
        status: 'needs_review',
        rawText: '',
      });
      warnings.push({
        code: 'PDF_TEXT_EXTRACTION_PENDING',
        artifactId: artifact.id,
        message: `${artifact.name} was accepted as a source, but PDF text extraction still requires the server PDF adapter. Add a screenshot or pasted text for automatic suggestions in this pilot build.`,
      });
      onProgress?.({ index, total: sources.length, source: artifact.name, progress: 1 });
      continue;
    }

    try {
      const parsed = artifact.text
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

      if (!parsed.rawText.trim() || (parsed.source === 'image' && parsed.confidence < 45)) {
        warnings.push({
          code: 'OCR_REVIEW_NEEDED',
          artifactId: artifact.id,
          message: `${artifact.name} produced ${parsed.rawText.trim() ? 'low-confidence' : 'no'} readable text. Try a tighter screenshot with clear text, or enter the missing details manually.`,
        });
      }

      for (const [field, value] of Object.entries(parsed.fields)) {
        if (!value) continue;
        (candidates[field] ||= []).push(fieldCandidate(artifact, field, value));
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
    workModes: unique([
      /\bremote\b/i.test(combinedText) && 'Remote',
      /\bhybrid\b/i.test(combinedText) && 'Hybrid',
      /on[- ]?site|in person/i.test(combinedText) && 'In person',
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
    processing: { completedAt: new Date().toISOString() },
  };
}
