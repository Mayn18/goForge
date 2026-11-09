import { load, subscribe } from './store.js';
import { h, $, $$ } from './dom.js';
import { openSearch } from './search.js';

load();
const main = $('#main');
let cleanup = null; let token = 0;

const routes = [
  [/^$/, 'dashboard', () => import('./views/dashboard.js').then((m) => m.default), ''],
  [/^tree$/, 'tree', () => import('./views/treeView.js').then((m) => m.default), 'tree'],
  [/^node\/([\w-]+)$/, 'node', () => import('./views/lesson.js').then((m) => m.default), 'tree', ['id']],
  [/^diagnostic$/, 'diagnostic', () => import('./views/diagnostic.js').then((m) => m.default), 'diagnostic'],
  [/^capstone$/, 'capstone', () => import('./views/capstone.js').then((m) => m.capstoneView), 'capstone'],
  [/^capstone\/([\w-]+)$/, 'stage', () => import('./views/capstone.js').then((m) => m.stageView), 'capstone', ['id']],
  [/^projects$/, 'projects', () => import('./views/projects.js').then((m) => m.projectList), 'projects'],
  [/^project\/([\w-]+)$/, 'project', () => import('./views/projects.js').then((m) => m.projectDetail), 'projects', ['id']],
  [/^reference$/, 'reference', () => import('./views/reference.js').then((m) => m.default), 'reference'],
  [/^guide$/, 'guide', () => import('./views/guide.js').then((m) => m.default), 'guide'],
];

async function route() {
  const my = ++token;
  const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const query = new URLSearchParams(qs || '');
  try { cleanup?.(); } catch { /* ignore */ } cleanup = null;
  const hit = routes.map((r) => [r, r[0].exec(path)]).find(([, m]) => m);
  main.replaceChildren();
  $$('#nav a').forEach((a) => { if (hit && a.dataset.route === hit[0][3]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (!hit) { main.append(h('div', { class: 'wrap' }, h('h1', {}, 'Not found'), h('p', {}, h('a', { href: '#/' }, 'Back to the dashboard')))); return; }
  const [r, m] = hit; const params = {}; (r[4] || []).forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
  try {
    const view = await r[2]();
    if (my !== token) return;
    const out = await view(main, params, query);
    if (my !== token) { out?.(); return; }
    cleanup = typeof out === 'function' ? out : null;
  } catch (e) {
    console.error(e);
    if (my === token) main.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'banner banner--warn' }, `Something went wrong loading this page: ${e.message}`)));
  }
  if (!query.get('b')) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
}
window.addEventListener('hashchange', route);
route();

// theme
const root = document.documentElement;
$('#btn-theme').addEventListener('click', () => {
  const next = (root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'light' ? 'dark' : 'light';
  root.dataset.theme = next; try { localStorage.setItem('goforge:theme', next); } catch { /* ignore */ }
});
$('#btn-search').addEventListener('click', openSearch);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openSearch(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
});
void subscribe;
