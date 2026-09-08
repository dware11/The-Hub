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

const conocoPhillipsEmail = `
Hello Professors and Deans,
The ConocoPhillips IT recruiting team will be returning to PVAMU September 14-16 to connect with students and discuss internship and full-time opportunities for Information Technology, Computer Science, Cybersecurity, Computer Engineering, Data Analytics, and other related fields.
College of Business: Finance & IT Pre-Career Fair Networking
Monday, September 14, 2026
6:00 PM - 9:00 PM
Agriculture Business Building
College of Engineering: STEM Town
Monday, September 14, 2026
6:00 PM - 9:00 PM
ENCARB Building Lobby
PVAMU Career Fair
September 15-16, 2026
10:00 AM - 3:00 PM
Student Recreation Center
Jada Burks (She/her/hers)
IT Business Analyst
Operations & Maintenance
Phone: 281-293-2728
Email: Jada.Burks@conocophillips.com
`;

const result = await parseMultipleSources({ contentType: 'event', artifacts: [], pastedText: conocoPhillipsEmail });

assert.equal(result.fields.organization, 'ConocoPhillips');
assert.equal(result.fields.contactName, 'Jada Burks');
assert.equal(result.fields.contactEmail, 'Jada.Burks@conocophillips.com');
assert.equal(result.fields.date, '2026-09-14');
assert.match(result.fields.time, /6:00 PM/);
assert.equal(result.fields.location, 'Agriculture Business Building');
for (const expected of ['Internship', 'Career fair']) assert.ok(result.tags.categories.includes(expected), `Missing category tag: ${expected}`);
for (const expected of ['Information Technology', 'Computer Science', 'Cybersecurity', 'Computer Engineering', 'Data Analytics']) assert.ok(result.tags.majors.includes(expected), `Missing audience tag: ${expected}`);
for (const expected of ['Technology/software', 'Energy/oil and gas']) assert.ok(result.tags.sectors.includes(expected), `Missing sector tag: ${expected}`);
assert.ok(result.warnings.some((warning) => warning.code === 'MULTIPLE_EVENTS_DETECTED'), 'Multi-event email must require separate-record review.');

const disneyPosting = `
Disney Tech Internships Virtual Info Session
Date: September 9, 2026
Time: 5:00 PM–5:45 PM CST
Format: Virtual
Organization: The Walt Disney Company / Disney on the Yard
Audience: PVAMU students interested in Disney Tech internships
https://events.teams.microsoft.com/event/661e7c3d-ab42-49e5-8b60-227f34ea56be@56b731a8-a2ac-4c32-bf6b-616810e913c6
PVAMU virtual session covering Disney Tech internships and the transition from internship to full-time Disney employment.
`;
const disney = await parseMultipleSources({ contentType: 'event', artifacts: [], pastedText: disneyPosting });
assert.equal(disney.fields.title, 'Disney Tech Internships Virtual Info Session');
assert.equal(disney.fields.organization, 'The Walt Disney Company / Disney on the Yard');
assert.equal(disney.fields.date, '2026-09-09');
assert.match(disney.fields.time, /5:00 PM/);
assert.match(disney.fields.link, /^https:\/\/events\.teams\.microsoft\.com/);
assert.ok(disney.tags.categories.includes('Internship'));
assert.ok(disney.tags.sectors.includes('Technology/software'));

const panthersInventPosting = `
Panther's Invent 2026
Dates: September 11–13, 2026
Location: Nathelyne Archie-Kennedy Building & Fabrication Center
Type: Innovation Competition
Theme: Resilient Peace: Strength Through Innovation
Duration: 72-hour student innovation competition
Partner: Sandia National Laboratories
Registration: https://www.eventbrite.com/e/panthers-invent-2026-tickets-1998780178319?aff=oddtdtcreator
Registration deadline shown on flyer: September 3, 2026
Audience: Students across disciplines
Contact: dgsims@pvamu.edu
`;
const panthersInvent = await parseMultipleSources({ contentType: 'event', artifacts: [], pastedText: panthersInventPosting });
assert.equal(panthersInvent.fields.title, "Panther's Invent 2026");
assert.equal(panthersInvent.fields.date, '2026-09-11');
assert.equal(panthersInvent.fields.deadline, '2026-09-03');
assert.equal(panthersInvent.fields.location, 'Nathelyne Archie-Kennedy Building & Fabrication Center');
assert.equal(panthersInvent.fields.contactEmail, 'dgsims@pvamu.edu');
assert.match(panthersInvent.fields.link, /^https:\/\/www\.eventbrite\.com/);
assert.ok(panthersInvent.tags.categories.includes('Competition'));

console.log('Real parser examples passed: ConocoPhillips email, Disney Tech session, and Panther\'s Invent fields/tags/review warnings.');
