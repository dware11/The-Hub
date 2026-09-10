import fs from 'node:fs';

const nav = fs.readFileSync('components/Nav.js', 'utf8');
const desktop = fs.readFileSync('components/DesktopNavMenus.js', 'utf8');
const workspaceShell = fs.readFileSync('components/WorkspaceShell.js', 'utf8');
const workspaceNav = fs.readFileSync('components/WorkspaceNavigation.js', 'utf8');
const history = fs.readFileSync('app/admin/history/HistoryBrowser.js', 'utf8');

const workspaceRoutes = Object.fromEntries(
  [...workspaceNav.matchAll(/\{\s*label:\s*['"]([^'"]+)['"]\s*,\s*href:\s*['"]([^'"]+)['"]/g)]
    .map(([, label, href]) => [label, href])
);

const checks = [
  ['desktop menu component is wired', nav.includes('DesktopNavMenus')],
  ['Workspace trigger links to /admin', desktop.includes('label="Workspace" href="/admin"')],
  ['Workspace Overview maps to /admin', workspaceRoutes.Overview === '/admin'],
  ['Workspace intended routes are configured', Object.entries({
    'Review Queue': '/admin/review',
    'Content Management': '/admin/content',
    'People & Access': '/admin/people',
    Analytics: '/admin/analytics',
    History: '/admin/history',
    'System Insights': '/admin/system-insights',
  }).every(([label, href]) => workspaceRoutes[label] === href)],
  ['Discover is a non-link button', desktop.includes('label="Discover"') && desktop.includes('type="button"')],
  ['super-admin links are gated', desktop.includes('{superAdmin &&') && desktop.includes('/admin/history') && desktop.includes('/admin/system-insights')],
  ['Workspace shell uses shared navigation', workspaceShell.includes('<WorkspaceNavigation admin={admin} superAdmin={superAdmin} />')],
  ['mobile Workspace disclosure is semantic', workspaceNav.includes('type="button"') && workspaceNav.includes('aria-expanded={open}') && workspaceNav.includes('aria-controls="workspace-navigation"')],
  ['Workspace links expose active state', workspaceNav.includes("aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}")],
  ['history supports all requested filters', ['Action', 'Actor', 'Affected record', 'From date', 'To date', 'Sort'].every((label) => history.includes(`>${label}<`))],
  ['history sort supports newest/oldest', history.includes('value="newest"') && history.includes('value="oldest"')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) process.exit(1);
