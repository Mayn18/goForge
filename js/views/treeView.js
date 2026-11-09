import { h } from '../dom.js';
import { BRANCHES, LEVELS } from '../../data/branches.js';
import { NODES, NODE_MAP } from '../../data/nodes.js';
import { createTree } from '../tree.js';
import { nodeStatus, nodeProgress, unmetEssentials } from '../progress.js';
import { statusChip, pips, branch, nodeLink } from '../ui.js';
import { subscribe } from '../store.js';

function panel(id) {
  if (!id) return h('div', {}, h('h3', {}, 'Skill tree'), h('p', { class: 'small muted' }, 'Select a skill to inspect it. Double-click (or press the Open button) to enter. Scroll or pinch to zoom, drag to pan.'),
    h('p', { class: 'small muted' }, 'Solid lines are essential prerequisites; dashed lines are recommended. Dashed-border nodes are outlines awaiting a full lesson. Locked skills can still be explored.'),
    h('h4', {}, 'Difficulty'), h('ul', { class: 'list-clean small' }, LEVELS.map((l) => h('li', { style: { padding: '3px 0' } }, pips(l.n), ` ${l.name}`))));
  const n = NODE_MAP[id]; const un = unmetEssentials(id); const p = nodeProgress(id);
  return h('div', {}, h('div', { class: 'small muted' }, branch(n.b).name), h('h2', { style: { margin: '4px 0 10px' } }, n.title),
    h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginBottom: '10px' } }, statusChip(nodeStatus(id)), pips(n.lv), h('span', { class: `tag${n.full ? '' : ' tag--outline'}` }, n.full ? 'full lesson' : 'outline')),
    h('p', {}, n.s),
    n.full ? h('p', { class: 'small muted' }, `${p.done}/${p.total} items done`) : null,
    n.e.length ? [h('h4', {}, 'Essential first'), h('ul', { class: 'list-clean small' }, n.e.map((x) => h('li', { style: { padding: '3px 0' } }, nodeLink(x))))] : null,
    n.r.length ? [h('h4', {}, 'Recommended'), h('ul', { class: 'list-clean small' }, n.r.map((x) => h('li', { style: { padding: '3px 0' } }, nodeLink(x, false))))] : null,
    un.length ? h('p', { class: 'banner banner--warn small' }, 'Essential prerequisites are unmet. You may still explore.') : null,
    h('a', { class: 'btn', href: `#/node/${id}`, style: { marginTop: '12px' } }, 'Open skill'));
}

function listView(root) {
  return h('div', { class: 'wrap tree-list' }, BRANCHES.map((b) => h('div', { class: 'branch' }, h('h2', { style: { color: b.color } }, `${b.id} · ${b.name}`), h('p', { class: 'muted small' }, b.blurb),
    h('ul', {}, NODES.filter((n) => n.b === b.id).sort((a, c) => a.lv - c.lv).map((n) => h('li', { class: 'card' }, h('a', { href: `#/node/${n.id}`, style: { fontWeight: 700 } }, n.title),
      h('div', { class: 'row', style: { gap: '8px', marginTop: '6px', flexWrap: 'wrap' } }, statusChip(nodeStatus(n.id)), pips(n.lv), h('span', { class: `tag${n.full ? '' : ' tag--outline'}` }, n.full ? 'lesson' : 'outline'))))))));
}

export default function treeView(root, _p, query) {
  document.title = 'Skill tree · GoForge';
  const mode = (() => { try { return localStorage.getItem('goforge:treemode') || 'graph'; } catch { return 'graph'; } })();
  const host = h('div', { class: 'wrap--wide' });
  root.append(host);
  let cleanup = () => {};
  const setMode = (m) => { try { localStorage.setItem('goforge:treemode', m); } catch { /* ignore */ } host.replaceChildren(); cleanup(); mount(m); };

  function mount(m) {
    const toggle = h('div', { class: 'row', style: { gap: '8px', padding: '10px 14px', justifyContent: 'space-between' } },
      h('div', { class: 'small muted' }, `${NODES.length} skills across 9 branches`),
      h('div', { class: 'row', style: { gap: '6px' } }, h('button', { class: 'chip', type: 'button', 'aria-pressed': m === 'graph', onClick: () => setMode('graph') }, 'Graph'), h('button', { class: 'chip', type: 'button', 'aria-pressed': m === 'list', onClick: () => setMode('list') }, 'List (accessible)')));
    host.append(toggle);
    if (m === 'list') { host.append(listView()); cleanup = () => {}; return; }
    const canvas = h('div', { class: 'tree-canvas' }); const side = h('aside', { class: 'tree-panel', 'aria-live': 'polite' }, panel(null));
    host.append(h('div', { class: 'tree-shell' }, canvas, side));
    const tree = createTree(canvas, { onSelect: (id) => side.replaceChildren(panel(id)), onOpen: (id) => { location.hash = `#/node/${id}`; } });
    const bar = h('div', { class: 'tree-bar' }, h('button', { class: 'chip', type: 'button', onClick: () => tree.showAll() }, 'All'),
      BRANCHES.map((b) => h('button', { class: 'chip', type: 'button', style: { '--c': b.color }, title: b.name, onClick: () => tree.focusBranch(b.id) }, h('span', { class: 'branch-dot', style: { '--c': b.color } }), b.id)));
    const zoom = h('div', { class: 'tree-zoom' }, h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Zoom in', onClick: () => tree.zoom(1.25) }, '+'), h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Zoom out', onClick: () => tree.zoom(0.8) }, '−'), h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Fit to screen', onClick: () => tree.fit() }, '⤢'));
    const legend = h('div', { class: 'tree-legend' }, [['available', 'var(--info)'], ['in progress', 'var(--warn)'], ['practiced', 'var(--ok)'], ['mastered', 'var(--spark)'], ['locked', 'var(--ink-3)']].map(([t, c]) => h('span', { style: { marginRight: '10px', whiteSpace: 'nowrap' } }, h('span', { style: { color: c } }, '● '), t)));
    canvas.append(bar, zoom, legend);
    tree.refresh();
    const q = query?.get('b'); if (q && BRANCHES.some((b) => b.id === q)) requestAnimationFrame(() => tree.focusBranch(q));
    const unsub = subscribe(() => tree.refresh());
    cleanup = () => { unsub(); tree.destroy?.(); };
  }
  mount(mode);
  return () => cleanup();
}
