import { h, $, esc } from './dom.js';
import { NODES } from '../data/nodes.js';
import { PROJECTS } from '../data/projects.js';
import { STAGES } from '../data/capstone.js';
import { collectRefs } from './views/reference.js';

let index = null;
async function build() {
  if (index) return index;
  const items = [];
  NODES.forEach((n) => items.push({ kind: n.full ? 'Lesson' : 'Outline', title: n.title, text: n.s, href: `#/node/${n.id}` }));
  PROJECTS.forEach((p) => items.push({ kind: 'Project', title: p.title, text: p.tagline, href: `#/project/${p.id}` }));
  STAGES.forEach((s) => items.push({ kind: 'Beep-Bot', title: `Stage ${s.n}: ${s.title}`, text: s.goal, href: `#/capstone/${s.id}` }));
  (await collectRefs()).forEach((r) => items.push({ kind: 'Docs', title: r.title, text: `${r.source} ${r.note}`, href: r.url, ext: true }));
  return (index = items);
}

export async function openSearch() {
  const ov = $('#overlay'); if (!ov.hidden) return;
  const input = h('input', { type: 'search', placeholder: 'Search skills, projects, stages, documentation…', 'aria-label': 'Search', autocomplete: 'off' });
  const res = h('div', { class: 'search-results', role: 'listbox' });
  const close = () => { ov.hidden = true; ov.replaceChildren(); document.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  const prev = document.activeElement; let sel = 0;
  const onKey = (e) => {
    const links = [...res.querySelectorAll('a')];
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(links.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter' && links[sel]) { e.preventDefault(); links[sel].click(); }
  };
  const mark = () => [...res.querySelectorAll('a')].forEach((a, i) => { a.classList.toggle('on', i === sel); if (i === sel) a.scrollIntoView({ block: 'nearest' }); });
  ov.hidden = false; ov.replaceChildren(h('div', { class: 'search-box', onClick: (e) => { if (e.target.classList.contains('search-box')) close(); } }, h('div', { class: 'search-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' }, input, res)));
  document.addEventListener('keydown', onKey, true); input.focus();
  const items = await build();
  const run = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean); sel = 0;
    const hits = (terms.length ? items.map((it) => { const t = it.title.toLowerCase(), x = (it.text || '').toLowerCase(); let sc = 0; for (const w of terms) { if (t.includes(w)) sc += 3; else if (x.includes(w)) sc += 1; else return null; } return { it, sc }; }).filter(Boolean).sort((a, b) => b.sc - a.sc).map((r) => r.it) : items.filter((i) => i.kind === 'Lesson')).slice(0, 30);
    res.replaceChildren(...(hits.length ? hits.map((it) => h('a', { href: it.href, role: 'option', ...(it.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {}), onClick: () => { if (!it.ext) setTimeout(close, 0); else close(); } }, h('strong', {}, it.title), ' ', h('span', { class: 'tag' }, it.kind), h('span', { class: 'snip' }, (it.text || '').slice(0, 110)))) : [h('p', { class: 'muted', style: { padding: '16px 18px' } }, 'Nothing matches.')]));
    mark();
  };
  input.addEventListener('input', run); run();
}
