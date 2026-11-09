// Derived progress: statuses are computed from recorded activity, never just toggled.
//   locked      essential prerequisites not yet practiced (and nothing recorded here yet)
//   available   prerequisites met, nothing started
//   in_progress something recorded (exercise, note, quiz answer, ...)
//   practiced   every exercise done  (outline nodes: self-attested coverage or diagnostic)
//   mastered    claimed after passing every mastery gate (see masteryGates)
import { get } from './store.js';
import { NODES, NODE_MAP } from '../data/nodes.js';
import { BRANCHES } from '../data/branches.js';
import { words } from './dom.js';

const count = (o) => Object.values(o || {}).filter(Boolean).length;
const hasActivity = (r) => !!r && (count(r.ex) || r.ch || Object.keys(r.quiz || {}).length || count(r.cr) || r.notes || r.teach || r.started || r.selfCovered || r.opened);

export function rawStatus(id) {
  const n = NODE_MAP[id]; const r = get().nodes[id];
  if (!r) return 'none';
  if (r.mastered) return 'mastered';
  if (n.full) {
    if (count(r.ex) >= n.full.ex || r.seed) return 'practiced';
    if (hasActivity(r)) return 'in_progress';
  } else {
    if (r.selfCovered || r.seed) return 'practiced';
    if (r.started || r.notes) return 'in_progress';
  }
  return 'none';
}
export const satisfied = (id) => ['practiced', 'mastered'].includes(rawStatus(id));
export const unmetEssentials = (id) => NODE_MAP[id].e.filter((p) => !satisfied(p));
export function nodeStatus(id) {
  const raw = rawStatus(id);
  if (raw !== 'none') return raw;
  return unmetEssentials(id).length ? 'locked' : 'available';
}
export function masteryGates(id) {
  const n = NODE_MAP[id]; const r = get().nodes[id] || { ex: {}, quiz: {}, cr: {} };
  if (!n.full) return null;
  const answered = Object.keys(r.quiz || {}).length;
  const ok = Object.values(r.quiz || {}).filter((v) => v === 'ok').length;
  const gates = [
    { label: `All ${n.full.ex} exercises completed`, ok: count(r.ex) >= n.full.ex },
    { label: 'Engineering challenge completed', ok: !!r.ch },
    { label: `Knowledge check: answered all ${n.full.q} and self-graded at least 80% correct`, ok: answered >= n.full.q && ok / n.full.q >= 0.8 },
    { label: `All ${n.full.cr} mastery criteria confirmed`, ok: count(r.cr) >= n.full.cr },
    { label: 'Teach-back written in your own words (40+ words)', ok: words(r.teach || '') >= 40 },
  ];
  return { gates, eligible: gates.every((g) => g.ok) };
}
export function nodeProgress(id) {
  const n = NODE_MAP[id]; const r = get().nodes[id];
  if (!n.full || !r) return { done: 0, total: n.full ? n.full.ex + 1 + n.full.q + n.full.cr : 0 };
  const done = count(r.ex) + (r.ch ? 1 : 0) + Object.keys(r.quiz || {}).length + count(r.cr);
  return { done, total: n.full.ex + 1 + n.full.q + n.full.cr };
}
export function branchStats(bid) {
  const list = NODES.filter((n) => n.b === bid); const by = { locked: 0, available: 0, in_progress: 0, practiced: 0, mastered: 0 };
  list.forEach((n) => by[nodeStatus(n.id)]++);
  const done = by.practiced + by.mastered;
  return { total: list.length, ...by, done, pct: Math.round((done / list.length) * 100), full: list.filter((n) => n.full).length };
}
export function overall() {
  const by = { locked: 0, available: 0, in_progress: 0, practiced: 0, mastered: 0 };
  NODES.forEach((n) => by[nodeStatus(n.id)]++);
  return { total: NODES.length, ...by, full: NODES.filter((n) => n.full).length };
}
/** Next steps: in-progress first, then available full lessons by level, then available outlines. */
export function recommendations(limit = 4) {
  const inprog = NODES.filter((n) => nodeStatus(n.id) === 'in_progress');
  const avail = NODES.filter((n) => nodeStatus(n.id) === 'available').sort((a, b) => (b.full ? 1 : 0) - (a.full ? 1 : 0) || a.lv - b.lv);
  return [...inprog, ...avail].slice(0, limit);
}
/** Concepts worth revisiting: missed knowledge-check questions and wrong diagnostic answers. */
export function weakSpots() {
  const out = [];
  for (const [id, r] of Object.entries(get().nodes)) {
    const miss = Object.entries(r.quiz || {}).filter(([, v]) => v === 'miss').map(([k]) => k);
    if (miss.length) out.push({ id, kind: 'quiz', detail: `${miss.length} knowledge-check question${miss.length > 1 ? 's' : ''} missed`, q: miss });
  }
  const d = get().diagnostic;
  if (d) {
    const byNode = {};
    for (const [qid, ok] of Object.entries(d.correct || {})) if (!ok) { const nid = d.nodes?.[qid]; if (nid) (byNode[nid] ||= []).push(qid); }
    for (const [id, qs] of Object.entries(byNode)) if (NODE_MAP[id] && !satisfied(id)) out.push({ id, kind: 'diagnostic', detail: `${qs.length} diagnostic question${qs.length > 1 ? 's' : ''} missed` });
  }
  return out;
}
export const branchOf = (id) => BRANCHES.find((b) => b.id === NODE_MAP[id].b);
