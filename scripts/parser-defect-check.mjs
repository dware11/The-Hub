import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const context = vm.createContext({ console, Date, setTimeout, clearTimeout, URL, Blob, Promise });
const modules = new Map();

async function loadModule(filePath) {
  const resolved = path.resolve(filePath);
  if (modules.has(resolved)) return modules.get(resolved);
  const source = await fs.readFile(resolved, 'utf8');
  const module = new vm.SourceTextModule(source, {
    context,
    identifier: pathToFileURL(resolved).href,
    importModuleDynamically: async () => { throw new Error('Dynamic imports are not used by text-only parser checks.'); },
  });
  modules.set(resolved, module);
  await module.link(async (specifier) => loadModule(path.resolve(path.dirname(resolved), specifier.endsWith('.js') ? specifier : `${specifier}.js`)));
  await module.evaluate();
  return module;
}

const parserModule = await loadModule(path.join(projectRoot, 'lib', 'multiSourceParser.js'));
const { parseMultipleSources } = parserModule.namespace;

const ocrDefect = await parseMultipleSources({
  contentType: 'event',
  artifacts: [],
  pastedText: `
Fundamentals of Verliog HDL
Organization: Maker Space Lab
Date: Septmeber 24, 2026
Time: 3:OO PM - 5:00 PM
Venue: Maker Space Lab
Learn the fundamentals of Verilog HDL and implement basic logic gates through simulation and FPGA-based practice.
Contact: makerspace@pvamu.edu
`,
});

assert.equal(ocrDefect.fields.title, 'Fundamentals of Verliog HDL', 'Ordinary title words must not be silently spell-corrected.');
assert.equal(ocrDefect.fields.date, '2026-09-24', 'Known month transpositions should normalize in structured dates.');
assert.match(ocrDefect.fields.time, /^3:00 PM\s*[–-]\s*5:00 PM$/, 'O/0 OCR swaps should normalize inside clock values.');
assert.equal(ocrDefect.fields.location, 'Maker Space Lab');
assert.ok(ocrDefect.warnings.some((warning) => warning.code === 'OCR_NORMALIZATION_APPLIED'));
assert.ok(ocrDefect.uncertainFields.some((item) => item.field === 'date'));
assert.ok(ocrDefect.uncertainFields.some((item) => item.field === 'time'));

const unsafeUnknowns = await parseMultipleSources({
  contentType: 'event',
  artifacts: [],
  pastedText: `
Enginering Student Meetup
Date: Smarch 44, 2026
Time: someday after lunch
Venue: T8A
Contact: student(at)pvamu(dot)edu
`,
});

assert.ok(!unsafeUnknowns.fields.date, 'Unknown/invalid dates must remain missing instead of being invented.');
assert.ok(!unsafeUnknowns.fields.time, 'Unparseable times must remain missing instead of being invented.');
assert.ok(!unsafeUnknowns.fields.contactEmail, 'Malformed contact addresses must remain missing.');
assert.equal(unsafeUnknowns.fields.title, 'Enginering Student Meetup', 'Unstructured names/titles must remain faithful to the source.');

const mixedCharacters = await parseMultipleSources({
  contentType: 'event',
  artifacts: [],
  pastedText: `
Hardware Design Workshop
Organization: College of Engineering
Date: October 2, 2026
Time: 1O:3O AM–12:00 PM
Location: ENCARB Room 137
`,
});

assert.match(mixedCharacters.fields.time, /^10:30 AM\s*[–-]\s*12:00 PM$/, 'O/0 swaps in both the hour and minutes should normalize without losing the start time.');
assert.ok(mixedCharacters.warnings.some((warning) => warning.code === 'OCR_NORMALIZATION_APPLIED'));
assert.ok(mixedCharacters.uncertainFields.some((item) => item.field === 'time'));

console.log('Parser defect checks passed: structured OCR corrections are review-flagged, while unknown spelling/date/time/email defects remain uninvented.');
