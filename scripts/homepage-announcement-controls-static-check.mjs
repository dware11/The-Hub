import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manager = read('app/admin/content/ContentManager.js');
const actions = read('app/admin/content/actions.js');
const home = read('app/page.js');
const css = read('app/globals.css');
const migration = read('supabase/migrations/20260929212940_homepage_announcement_highlight_control.sql');

assert.match(manager, /Highlight in Latest Announcements/);
assert.match(manager, /Remove homepage highlight/);
assert.match(manager, /content-action-group content-placement-actions/);
assert.match(manager, /content-action-group content-lifecycle-actions/);
assert.match(manager, /1 · First/);
assert.match(actions, /manage_home_announcement/);
assert.match(home, /Boolean\(b\.pinned\).*Boolean\(a\.pinned\)/);
assert.match(css, /\.content-action-group\{/);
assert.match(css, /\.content-placement-actions\{/);
assert.match(migration, /role in \('admin', 'super_admin'\)/);
assert.match(migration, /Only published announcements can be highlighted/);
assert.match(migration, /revoke all on function public\.manage_home_announcement\(uuid, boolean\) from public, anon/);
assert.match(migration, /grant execute on function public\.manage_home_announcement\(uuid, boolean\) to authenticated/);

console.log('Homepage announcement controls and grouped content actions checks passed.');
