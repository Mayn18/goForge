import { h } from '../dom.js';
import { CORE_REFS } from '../../data/refs.js';
import { NODES } from '../../data/nodes.js';
import { loadAllLessons, parseDocLines } from '../lessons.js';

/** Every reference the system knows: core list + outline-node docs + lesson docs, de-duplicated by URL. */
export async function collectRefs() {
  const map = new Map();
  const add = (title, url, kind, source, note, nodes = []) => {
    const e = map.get(url) || { title, url, kind, source, note, nodes: [] };
    nodes.forEach((n) => { if (!e.nodes.includes(n)) e.nodes.push(n); });
    if (kind === 'official') e.kind = 'official';
    if (!map.has(url)) map.set(url, e);
  };
  CORE_REFS.forEach(([t, u, k, s, n]) => add(t, u, k === 'supp' ? 'supplementary' : 'official', s, n));
  NODES.filter((n) => !n.full).forEach((n) => n.d.forEach(([t, u]) => add(t, u, 'official', host(u), '', [n.id])));
  for (const l of await loadAllLessons()) {
    const s = l.byTitle['Official documentation']; if (!s) continue;
    parseDocLines(s.md).docs.forEach((d) => add(d.title, d.url, d.kind, host(d.url), d.why, [l.id]));
  }
  return [...map.values()];
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

export default async function reference(root) {
  document.title = 'Reference library · GoForge';
  const wrap = h('div', { class: 'wrap' }); root.append(wrap);
  wrap.append(h('div', { class: 'page-head' }, h('h1', {}, 'Reference library'), h('p', {}, 'Official documentation is the primary source; supplementary material is labelled as such. Everything linked from a lesson or an outline node is collected here. Assumed Go version: 1.22+.')));
  const refs = await collectRefs();
  const q = h('input', { type: 'search', placeholder: 'Filter by title, topic, or site…', 'aria-label': 'Filter references' });
  const kind = h('select', { 'aria-label': 'Filter by source type' }, h('option', { value: '' }, 'All sources'), h('option', { value: 'official' }, 'Official only'), h('option', { value: 'supplementary' }, 'Supplementary only'));
  const list = h('div', { class: 'stack' }); const count = h('p', { class: 'small muted' });
  const paint = () => {
    const t = q.value.trim().toLowerCase();
    const rows = refs.filter((r) => (!kind.value || r.kind === kind.value) && (!t || `${r.title} ${r.source} ${r.note} ${r.url}`.toLowerCase().includes(t))).sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
    count.textContent = `${rows.length} of ${refs.length} references`;
    const by = {}; rows.forEach((r) => (by[r.source || 'Other'] ||= []).push(r));
    list.replaceChildren(...Object.entries(by).map(([src, items]) => h('section', {}, h('h3', {}, src), h('ul', { class: 'docs-list' }, items.map((r) => h('li', {},
      h('span', { class: `tag tag--${r.kind === 'official' ? 'official' : 'supp'}` }, r.kind), h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title), r.note ? h('span', { class: 'why' }, r.note) : null,
      r.nodes.length ? h('span', { class: 'why small' }, 'Used in: ', r.nodes.map((n, i) => [i ? ', ' : '', h('a', { href: `#/node/${n}` }, NODES.find((x) => x.id === n)?.title || n)])) : null))))));
  };
  q.addEventListener('input', paint); kind.addEventListener('change', paint);
  wrap.append(h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginBottom: '8px' } }, h('div', { style: { flex: '1 1 260px' } }, q), kind), count, list);
  paint();
}
