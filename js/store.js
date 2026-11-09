// All learner state lives in localStorage under one key. No accounts, no server.
// Shape (v1):
//   nodes[id]    : { opened, ex:{n:true}, ch:bool, quiz:{n:'ok'|'miss'}, cr:{n:true}, notes, teach, mastered, selfCovered, seed, t }
//   diagnostic   : { date, answers:{qid:choice}, correct:{qid:bool} } | null
//   projects[id] : { ms:{n:true}, ac:{n:true}, notes }
//   capstone[id] : { ms:{n:true}, ac:{n:true}, notes, decisions:{n:text} }
//   history[]    : { t, type, id, label }

const KEY = 'goforge:v1';
const blank = () => ({ nodes: {}, diagnostic: null, projects: {}, capstone: {}, history: [] });
let state = blank();
const subs = new Set();
let timer = null;

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) state = { ...blank(), ...JSON.parse(raw) }; } catch { state = blank(); }
  return state;
}
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked or full */ } }, 150);
}
export const get = () => state;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function commit() { persist(); subs.forEach((f) => f(state)); }

export const nodeRec = (id) => (state.nodes[id] ||= { ex: {}, quiz: {}, cr: {} });
export const projRec = (id) => (state.projects[id] ||= { ms: {}, ac: {}, notes: '' });
export const capRec = (id) => (state.capstone[id] ||= { ms: {}, ac: {}, notes: '', decisions: {} });

export function log(type, id, label) {
  const last = state.history[0];
  if (last && last.type === type && last.id === id && last.label === label && Date.now() - last.t < 60000) return;
  state.history.unshift({ t: Date.now(), type, id, label });
  state.history.length = Math.min(state.history.length, 300);
}
export function exportJSON() { return JSON.stringify({ app: 'goforge', version: 1, exportedAt: new Date().toISOString(), state }, null, 2); }
export function importJSON(text) {
  const data = JSON.parse(text);
  if (data.app !== 'goforge' || !data.state) throw new Error('This is not a GoForge export file.');
  state = { ...blank(), ...data.state };
  persist(); subs.forEach((f) => f(state));
}
export function reset() { state = blank(); try { localStorage.removeItem(KEY); } catch { /* ignore */ } subs.forEach((f) => f(state)); }
