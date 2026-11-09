// Interactive skill tree: layered layout from the prerequisite graph, rendered as SVG with pan/zoom.
import { NODES, NODE_MAP } from '../data/nodes.js';
import { BRANCHES } from '../data/branches.js';
import { nodeStatus } from './progress.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 164, H = 54, GX = 14, ROW = 104, TOP = 74, LANE_GAP = 46;
const el = (tag, attrs = {}, kids = []) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  kids.forEach((c) => e.append(c));
  return e;
};

/** Longest-path depth over all prerequisite edges. */
function depths() {
  const memo = {}; const stack = new Set();
  const d = (id) => {
    if (memo[id] != null) return memo[id];
    if (stack.has(id)) throw new Error(`Prerequisite cycle at ${id}`);
    stack.add(id);
    const n = NODE_MAP[id]; const ps = [...n.e, ...n.r];
    memo[id] = ps.length ? 1 + Math.max(...ps.map(d)) : 0;
    stack.delete(id);
    return memo[id];
  };
  NODES.forEach((n) => d(n.id));
  return memo;
}

export function layout() {
  const dep = depths(); const pos = {}; const lanes = []; let x0 = 20;
  for (const b of BRANCHES) {
    const list = NODES.filter((n) => n.b === b.id);
    const byDepth = {};
    list.forEach((n) => (byDepth[dep[n.id]] ||= []).push(n));
    const cols = Math.max(...Object.values(byDepth).map((a) => a.length));
    const width = cols * W + (cols - 1) * GX;
    for (const [dd, arr] of Object.entries(byDepth)) {
      const rowW = arr.length * W + (arr.length - 1) * GX; const off = (width - rowW) / 2;
      arr.forEach((n, i) => (pos[n.id] = { x: x0 + off + i * (W + GX), y: TOP + dd * ROW }));
    }
    lanes.push({ b, x: x0, width });
    x0 += width + LANE_GAP;
  }
  const height = TOP + (Math.max(...Object.values(dep)) + 1) * ROW + 30;
  return { pos, lanes, width: x0, height, dep };
}

const wrap = (s, max = 22) => {
  const out = []; let line = '';
  for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  out.push(line); return out.slice(0, 2).map((t, i, a) => (i === 1 && out.length > 2 ? t.replace(/.{1,2}$/, '…') : t));
};

export function createTree(host, { onSelect, onOpen }) {
  const L = layout();
  const svg = el('svg', { role: 'group', 'aria-label': 'Skill tree. Use Tab to move between skills, Enter to inspect.', tabindex: '-1' });
  const world = el('g'); svg.append(world);
  const edgeLayer = el('g'); const laneLayer = el('g'); const nodeLayer = el('g');
  world.append(laneLayer, edgeLayer, nodeLayer);

  L.lanes.forEach(({ b, x, width }) => {
    laneLayer.append(el('rect', { x: x - 8, y: 16, width: width + 16, height: L.height - 24, rx: 14, fill: b.color, opacity: '.045' }));
    const t = el('text', { x, y: 46, class: 'lane-title', fill: b.color }); t.textContent = `${b.id} · ${b.name}`; laneLayer.append(t);
  });

  const edges = [];
  NODES.forEach((n) => [['e', n.e], ['r', n.r]].forEach(([kind, ps]) => ps.forEach((p) => {
    const a = L.pos[p], b = L.pos[n.id]; const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y; const my = (y1 + y2) / 2;
    const path = el('path', { d: `M${x1} ${y1} C${x1} ${my},${x2} ${my},${x2} ${y2}`, class: `edge${kind === 'r' ? ' rec' : ''}` });
    edgeLayer.append(path); edges.push({ from: p, to: n.id, path });
  })));

  const gs = {};
  NODES.forEach((n) => {
    const p = L.pos[n.id]; const b = BRANCHES.find((x) => x.id === n.b);
    const lines = wrap(n.title);
    const g = el('g', { class: 'tnode', transform: `translate(${p.x},${p.y})`, tabindex: '0', role: 'button', style: `--c:${b.color}` });
    const rect = el('rect', { class: 'box', width: W, height: H, rx: 9 });
    g.append(rect);
    lines.forEach((ln, i) => { const t = el('text', { x: 12, y: 19 + i * 14 }); t.textContent = ln; g.append(t); });
    const sub = el('text', { x: 12, y: H - 7, class: 'sub' }); sub.textContent = `L${n.lv} · ${n.full ? 'lesson' : 'outline'}`; g.append(sub);
    g.append(el('circle', { class: 'sdot', cx: W - 14, cy: 14, r: 5 }), el('circle', { class: 'sring', cx: W - 14, cy: 14, r: 8, fill: 'none', 'stroke-width': 1.5 }));
    g.addEventListener('click', () => { if (!moved) select(n.id); });
    g.addEventListener('dblclick', () => onOpen(n.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } });
    nodeLayer.append(g); gs[n.id] = g;
  });

  host.append(svg);
  let selected = null, branchFilter = null, view = { x: 20, y: 0, k: 0.8 }, moved = false;
  const apply = () => world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  const clampK = (k) => Math.min(1.6, Math.max(0.22, k));

  function refresh() {
    NODES.forEach((n) => {
      const g = gs[n.id]; const st = nodeStatus(n.id);
      g.setAttribute('class', `tnode ${n.full ? '' : 'outline'} ${st === 'locked' ? 'locked' : ''} ${selected === n.id ? 'sel' : ''}`);
      g.setAttribute('aria-label', `${n.title}. Level ${n.lv}. ${n.full ? 'Full lesson' : 'Outline'}. Status: ${st.replace('_', ' ')}.`);
      const col = { locked: 'var(--ink-3)', available: 'var(--info)', in_progress: 'var(--warn)', practiced: 'var(--ok)', mastered: 'var(--spark)' }[st];
      g.querySelector('.sdot').setAttribute('fill', col); g.querySelector('.sring').setAttribute('stroke', col);
      g.querySelector('.sdot').setAttribute('r', st === 'mastered' ? 6 : 5);
      if (branchFilter) g.classList.toggle('dim', n.b !== branchFilter);
    });
    highlight();
  }
  function related(id) {
    const up = new Set(), down = new Set();
    const goUp = (x) => [...NODE_MAP[x].e, ...NODE_MAP[x].r].forEach((p) => { if (!up.has(p)) { up.add(p); goUp(p); } });
    const goDown = (x) => NODES.filter((n) => n.e.includes(x) || n.r.includes(x)).forEach((n) => { if (!down.has(n.id)) { down.add(n.id); goDown(n.id); } });
    goUp(id); goDown(id); return { up, down };
  }
  function highlight() {
    edges.forEach((e) => e.path.classList.remove('hl', 'dim'));
    if (!selected) return;
    const { up, down } = related(selected); const on = new Set([selected, ...up, ...down]);
    edges.forEach((e) => { const hit = on.has(e.from) && on.has(e.to) && (e.to === selected || up.has(e.to) || e.from === selected || down.has(e.from)); e.path.classList.toggle('hl', hit); e.path.classList.toggle('dim', !hit); });
    NODES.forEach((n) => gs[n.id].classList.toggle('dim', !on.has(n.id)));
  }
  function select(id, { center = false } = {}) {
    selected = id; branchFilter = null; refresh();
    if (center) centerOn(id);
    onSelect?.(id);
  }
  function clearSelection() { selected = null; NODES.forEach((n) => gs[n.id].classList.remove('dim')); refresh(); onSelect?.(null); }
  const size = () => host.getBoundingClientRect();
  function centerOn(id, k = view.k) {
    const p = L.pos[id]; const r = size(); view.k = k;
    view.x = r.width / 2 - (p.x + W / 2) * k; view.y = r.height / 2 - (p.y + H / 2) * k; animate();
  }
  function focusBranch(bid) {
    const lane = L.lanes.find((l) => l.b.id === bid); const r = size(); const k = clampK(Math.min(1, (r.width - 40) / (lane.width + 40)));
    view.k = k; view.x = 20 - (lane.x - 8) * k + Math.max(0, (r.width - (lane.width + 16) * k) / 2 - 20); view.y = 44; animate();
    selected = null; branchFilter = bid; refresh(); NODES.forEach((n) => gs[n.id].classList.toggle('dim', n.b !== bid)); edges.forEach((e) => e.path.classList.toggle('dim', NODE_MAP[e.to].b !== bid && NODE_MAP[e.from].b !== bid)); onSelect?.(null);
  }
  function showAll() { branchFilter = null; selected = null; NODES.forEach((n) => gs[n.id].classList.remove('dim')); fit(); refresh(); onSelect?.(null); }
  function fit() {
    const r = size(); const k = clampK(Math.min(r.width / L.width, r.height / L.height)); view.k = k; view.x = (r.width - L.width * k) / 2; view.y = 44; animate();
  }
  function animate() { world.style.transition = 'transform .35s cubic-bezier(.3,.7,.2,1)'; apply(); clearTimeout(animate.t); animate.t = setTimeout(() => (world.style.transition = ''), 400); }
  function zoomAt(f, cx, cy) {
    const k = clampK(view.k * f); const r = f === 1 ? 1 : k / view.k;
    view.x = cx - (cx - view.x) * r; view.y = cy - (cy - view.y) * r; view.k = k; apply();
  }
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null; const pts = new Map(); let pinch = 0;
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false;
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) { const r = svg.getBoundingClientRect(); zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); } pinch = d; moved = true; return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) { moved = true; host.classList.add('drag'); }
    if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); }
  });
  const end = (e) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) { drag = null; host.classList.remove('drag'); setTimeout(() => (moved = false), 0); } };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('click', (e) => { if (e.target === svg || e.target.closest('g') === world || e.target.tagName === 'rect' && !e.target.classList.contains('box')) { if (!moved && !e.target.closest('.tnode')) clearSelection(); } });
  new ResizeObserver(() => { if (!svg.dataset.init && size().width) { svg.dataset.init = '1'; initial(); } }).observe(host);
  function initial() { const r = size(); view.k = r.width < 700 ? 0.7 : 0.85; view.x = 14; view.y = 40; apply(); refresh(); }

  return {
    refresh, select, focusBranch, showAll, fit, selected: () => selected,
    zoom: (f) => { const r = size(); zoomAt(f, r.width / 2, r.height / 2); },
    destroy: () => svg.remove(),
  };
}
