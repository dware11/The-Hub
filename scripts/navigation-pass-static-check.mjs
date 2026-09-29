import fs from 'node:fs';

const nav = fs.readFileSync('components/Nav.js', 'utf8');
const desktop = fs.readFileSync('components/DesktopNavMenus.js', 'utf8');
const workspaceShell = fs.readFileSync('components/WorkspaceShell.js', 'utf8');
const workspaceNav = fs.readFileSync('components/WorkspaceNavigation.js', 'utf8');
const history = fs.readFileSync('app/admin/history/HistoryBrowser.js', 'utf8');
const mobile = fs.readFileSync('components/MobileNav.js', 'utf8');
const about = fs.readFileSync('app/about/page.js', 'utf8');

const workspaceRoutes = Object.fromEntries(
  [...workspaceNav.matchAll(/\{\s*label:\s*['"]([^'"]+)['"]\s*,\s*href:\s*['"]([^'"]+)['"]/g)]
    .map(([, label, href]) => [label, href])
);

const checks = [
  ['desktop menu component is wired', nav.includes('DesktopNavMenus')],
  ['Workspace trigger links to neutral gateway', desktop.includes('label="Workspace" href="/workspace"')],
  ['Workspace Overview maps to /admin', workspaceRoutes.Overview === '/admin'],
  ['Workspace intended routes are configured', Object.entries({
    'Review Queue': '/admin/review',
    'Content Management': '/admin/content',
    'People & Access': '/admin/people',
    Analytics: '/admin/analytics',
    Issues: '/admin/issues',
    History: '/admin/history',
    'System Insights': '/admin/system-insights',
  }).every(([label, href]) => workspaceRoutes[label] === href)],
  ['Discover is a non-link button', desktop.includes('label="Discover"') && desktop.includes('type="button"')],
  ['super-admin links are gated', desktop.includes('{superAdmin &&') && ['/admin/issues', '/admin/history', '/admin/system-insights'].every(route => desktop.includes(route))],
  ['Issues is grouped behind the Super Admin gate', /label: 'Super Admin', superOnly: true, items: \[\{ label: 'Issues', href: '\/admin\/issues' \}/.test(workspaceNav)],
  ['Workspace shell hides protected navigation when unauthorized', workspaceShell.includes('{reviewer && <WorkspaceNavigation admin={admin} superAdmin={superAdmin} />}')],
  ['contributors receive Submit to Hub, not reviewer Workspace navigation', desktop.includes('{contributor &&') && desktop.includes('Submit to Hub') && mobile.includes('{contributor &&')],
  ['signed-out public nav does not render a Workspace pill', !nav.includes('nav-workspace-link')],
  ['About custom navigation is role-aware', about.includes('showWorkspace={canReview(viewer)}')],
  ['mobile Workspace disclosure is semantic', workspaceNav.includes('type="button"') && workspaceNav.includes('aria-expanded={open}') && workspaceNav.includes('aria-controls="workspace-navigation"')],
  ['Workspace links expose active state', workspaceNav.includes("aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}")],
  ['history supports all requested filters', ['Action', 'Actor', 'Affected record', 'From date', 'To date', 'Sort'].every((label) => history.includes(`>${label}<`))],
  ['history sort supports newest/oldest', history.includes('value="newest"') && history.includes('value="oldest"')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) process.exit(1);
