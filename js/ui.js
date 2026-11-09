import { h } from './dom.js';
import { inline } from './md.js';
import { STATUSES, BRANCHES } from '../data/branches.js';
import { NODE_MAP } from '../data/nodes.js';
import { nodeStatus } from './progress.js';

export const statusChip = (st) => h('span', { class: `st st--${st}` }, STATUSES[st]);
export const pips = (lv) => h('span', { class: 'pips', role: 'img', 'aria-label': `Level ${lv} of 5` }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= lv ? 'on' : '' })));
export const branch = (id) => BRANCHES.find((b) => b.id === id);
export const branchTag = (id) => { const b = branch(id); return h('span', { class: 'row', style: { gap: '7px', display: 'inline-flex' } }, h('span', { class: 'branch-dot', style: { '--c': b.color } }), h('span', { class: 'small muted' }, b.name)); };
export const nodeLink = (id, withStatus = true) => {
  const n = NODE_MAP[id];
  return h('a', { href: `#/node/${id}`, class: 'row', style: { gap: '8px', display: 'inline-flex', flexWrap: 'nowrap', textDecoration: 'none' } },
    h('span', { class: 'branch-dot', style: { '--c': branch(n.b).color } }), h('span', {}, n.title), withStatus ? statusChip(nodeStatus(id)) : null);
};
export const pageHead = (title, sub) => h('div', { class: 'page-head' }, h('h1', {}, title), sub ? h('p', {}, sub) : null);
export function checklist(items, doneMap, onToggle, cls = 'criteria') {
  return h('ul', { class: cls }, items.map((t, i) => {
    const cb = h('input', { type: 'checkbox', checked: !!doneMap[i + 1], onChange: (e) => onToggle(i + 1, e.target.checked) });
    return h('li', {}, h('label', {}, cb, h('span', { html: inline(t) })));
  }));
}
export const bullets = (arr, cls = '') => h('ul', { class: cls, style: { paddingLeft: '1.3em', margin: '0 0 1em' } }, arr.map((t) => h('li', { style: { margin: '.35em 0' }, html: t })));
export const ring = (pctVal, color, label) => h('div', { class: 'ring', style: { '--p': pctVal, '--c': color }, 'data-t': label ?? `${pctVal}%`, role: 'img', 'aria-label': `${pctVal} percent` });
