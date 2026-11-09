// Loads and caches lesson Markdown, and exposes the parsed structure.
import { parseFront, splitSections, splitH3 } from './md.js';
import { NODES } from '../data/nodes.js';

export const SECTION_ORDER = ['Overview', 'Prerequisites', 'How it works', 'Official documentation', 'Practical examples', 'Hands-on exercises', 'Engineering challenge', 'Knowledge check', 'Mastery criteria', 'Further exploration'];
const cache = {};

export function loadLesson(id) {
  return (cache[id] ||= fetch(`content/nodes/${id}.md`).then((r) => { if (!r.ok) throw new Error(`Lesson file missing (${r.status})`); return r.text(); }).then((text) => {
    const { meta, body } = parseFront(text);
    const sections = splitSections(body);
    return { id, meta, sections, byTitle: Object.fromEntries(sections.map((s) => [s.title, s])), text };
  }));
}
export const fullNodes = () => NODES.filter((n) => n.full);
export async function loadAllLessons() {
  const out = []; for (const n of fullNodes()) { try { out.push(await loadLesson(n.id)); } catch { /* ignore missing in dev */ } } return out;
}

/** Parse "- [official] [Title](url) — why" lines. */
export function parseDocLines(md) {
  const docs = [], rest = [];
  for (const line of md.split('\n')) {
    const m = /^-\s+\[(official|supplementary)\]\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*(?:[—–-]\s*(.*))?$/.exec(line.trim());
    if (m) docs.push({ kind: m[1], title: m[2], url: m[3], why: m[4] || '' }); else rest.push(line);
  }
  return { docs, rest: rest.join('\n').trim() };
}
/** Knowledge-check item: question, then a line `>>>`, then the answer. */
export function parseQA(md) { const i = md.split('\n').findIndex((l) => l.trim() === '>>>'); const lines = md.split('\n'); return i < 0 ? { q: md, a: '' } : { q: lines.slice(0, i).join('\n').trim(), a: lines.slice(i + 1).join('\n').trim() }; }
export function criteriaItems(md) { return md.split('\n').filter((l) => /^-\s+/.test(l)).map((l) => l.replace(/^-\s+/, '')); }
export { splitH3 };
