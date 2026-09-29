import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const gateway = read('app/workspace/page.js');
const redirects = read('lib/authRedirects.js');
const nav = read('components/Nav.js');
const desktopNav = read('components/DesktopNavMenus.js');
const signIn = read('components/SignInButton.js');
const about = read('components/WhoIsCodeExperience.js');

assert.match(gateway, /getViewer/);
assert.match(gateway, /if \(!viewer\.user\) redirect\('\/auth\/signin\?next=%2Fworkspace'\)/);
assert.match(gateway, /if \(canReview\(viewer\)\) redirect\('\/admin'\)/);
assert.match(gateway, /if \(canSubmit\(viewer\)\) redirect\('\/panther-submit'\)/);
assert.match(gateway, /redirect\('\/panther-submit'\)/);
assert.match(redirects, /'\/workspace'/);
assert.match(redirects, /path === '\/admin' \|\| path\.startsWith\('\/admin\/'\)/);
assert.match(desktopNav, /label="Workspace" href="\/workspace"/);
assert.match(nav, /next="\/workspace"/);
assert.match(signIn, /next = '\/workspace'/);
assert.match(about, /href="\/workspace"/);
assert.doesNotMatch(nav, /href=\{reviewer \? '\/admin'/);

console.log('Workspace gateway checks passed: neutral entry, server-side role routing, safe admin destination normalization, and non-role-specific public labels.');
