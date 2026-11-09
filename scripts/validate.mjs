#!/usr/bin/env node
// Validates curriculum integrity. Run: node scripts/validate.mjs   (exit code 1 on any error)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { NODES, NODE_MAP } = await import(join(root, 'data/nodes.js'));
const { PROJECTS } = await import(join(root, 'data/projects.js'));
const { STAGES } = await import(join(root, 'data/capstone.js'));
const { DIAGNOSTIC } = await import(join(root, 'data/diagnostic.js'));
const { BRANCHES } = await import(join(root, 'data/branches.js'));

const SECTIONS = ['Overview', 'Prerequisites', 'How it works', 'Official documentation', 'Practical examples', 'Hands-on exercises', 'Engineering challenge', 'Knowledge check', 'Mastery criteria', 'Further exploration'];
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

// ---- nodes
const ids = new Set();
for (const n of NODES) {
  if (ids.has(n.id)) err(`duplicate node id ${n.id}`); ids.add(n.id);
  if (!BRANCHES.some((b) => b.id === n.b)) err(`${n.id}: unknown branch ${n.b}`);
  if (!(n.lv >= 1 && n.lv <= 5)) err(`${n.id}: level out of range`);
  if (!n.id.startsWith(n.b.toLowerCase() + '-')) warn(`${n.id}: id prefix does not match branch ${n.b}`);
  for (const p of [...n.e, ...n.r]) if (!NODE_MAP[p]) err(`${n.id}: unknown prerequisite ${p}`);
  for (const p of n.e) if (n.r.includes(p)) err(`${n.id}: ${p} is both essential and recommended`);
  if (!n.full && !n.d.length) err(`${n.id}: outline node has no documentation links`);
  for (const [t, u] of n.d) if (!/^https:\/\//.test(u)) err(`${n.id}: doc link not https: ${u}`);
}
// cycles (over essential + recommended edges)
const state = {};
const visit = (id, path) => {
  if (state[id] === 2) return; if (state[id] === 1) { err(`prerequisite cycle: ${[...path, id].join(' -> ')}`); return; }
  state[id] = 1; for (const p of [...NODE_MAP[id].e, ...NODE_MAP[id].r]) visit(p, [...path, id]); state[id] = 2;
};
NODES.forEach((n) => visit(n.id, []));

// ---- lessons
const files = new Set(existsSync(join(root, 'content/nodes')) ? readdirSync(join(root, 'content/nodes')).map((f) => f.replace(/\.md$/, '')) : []);
for (const f of files) if (!NODE_MAP[f] || !NODE_MAP[f].full) err(`content/nodes/${f}.md has no matching full node`);
const urls = new Set();
for (const n of NODES.filter((x) => x.full)) {
  if (!files.has(n.id)) { err(`${n.id}: marked full but content/nodes/${n.id}.md is missing`); continue; }
  const text = readFileSync(join(root, `content/nodes/${n.id}.md`), 'utf8');
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const secs = []; let cur = null, fence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && /^##\s+(.+)$/.exec(line);
    if (m) { cur = { t: m[1].trim(), lines: [] }; secs.push(cur); } else cur?.lines.push(line);
  }
  const titles = secs.map((s) => s.t);
  if (JSON.stringify(titles) !== JSON.stringify(SECTIONS)) err(`${n.id}: sections are [${titles.join(' | ')}], expected the ten required ones in order`);
  const sec = (t) => secs.find((s) => s.t === t)?.lines.join('\n') || '';
  const h3 = (t) => { let f = false, c = 0; for (const l of sec(t).split('\n')) { if (/^```/.test(l)) f = !f; if (!f && /^###\s/.test(l)) c++; } return c; };
  const ex = h3('Hands-on exercises'), q = h3('Knowledge check');
  const cr = sec('Mastery criteria').split('\n').filter((l) => /^-\s+/.test(l)).length;
  if (ex < 3) err(`${n.id}: needs at least 3 exercises (has ${ex})`);
  if (ex !== n.full.ex) err(`${n.id}: nodes.js says ${n.full.ex} exercises, lesson has ${ex}`);
  if (q !== n.full.q) err(`${n.id}: nodes.js says ${n.full.q} questions, lesson has ${q}`);
  if (cr !== n.full.cr) err(`${n.id}: nodes.js says ${n.full.cr} criteria, lesson has ${cr}`);
  const kc = sec('Knowledge check'); if ((kc.match(/^>>>\s*$/gm) || []).length !== q) err(`${n.id}: every knowledge question needs exactly one '>>>' separator`);
  if (sec('Engineering challenge').trim().length < 300) warn(`${n.id}: engineering challenge looks thin`);
  const docs = sec('Official documentation').split('\n').filter((l) => /^-\s/.test(l));
  let good = 0;
  for (const l of docs) { const m = /^-\s+\[(official|supplementary)\]\s+\[[^\]]+\]\((https:\/\/[^)]+)\)/.exec(l); if (!m) err(`${n.id}: malformed doc line: ${l.slice(0, 70)}`); else { good++; urls.add(m[2]); } }
  if (good < 3) err(`${n.id}: needs at least 3 documentation links`);
  if (!docs.some((l) => l.startsWith('- [official]'))) err(`${n.id}: no official documentation`);
  if (!/^go:\s*\S+/m.test(text.split('---')[1] || '')) err(`${n.id}: front matter must state the Go version (go: 1.22+)`);
  if (/^```go[\s\S]*?^```/m.test(sec('Hands-on exercises')) && ex) warn(`${n.id}: exercises contain code blocks; make sure they are not full solutions`);
  if (!/^>\s*\[!PITFALL\]/m.test(sec('Practical examples'))) warn(`${n.id}: practical examples should include at least one PITFALL callout`);
}
for (const n of NODES) n.d.forEach(([, u]) => urls.add(u));

// ---- projects, stages, diagnostic
for (const p of PROJECTS) {
  for (const k of ['requirements', 'constraints', 'milestones', 'acceptance', 'decisions', 'extensions']) if (!p[k]?.length) err(`project ${p.id}: missing ${k}`);
  for (const x of [...p.needs, ...p.rec]) if (!NODE_MAP[x]) err(`project ${p.id}: unknown skill ${x}`);
}
for (const s of STAGES) { for (const x of s.nodes) if (!NODE_MAP[x]) err(`stage ${s.id}: unknown skill ${x}`); if (!s.acceptance?.length) err(`stage ${s.id}: no acceptance`); }
const qids = new Set();
for (const q of DIAGNOSTIC) { if (qids.has(q.id)) err(`duplicate diagnostic id ${q.id}`); qids.add(q.id); if (!NODE_MAP[q.node]) err(`diagnostic ${q.id}: unknown node ${q.node}`); if (!(q.a >= 0 && q.a < q.opts.length)) err(`diagnostic ${q.id}: answer index out of range`); if (q.opts.length < 3) err(`diagnostic ${q.id}: too few options`); }

const full = NODES.filter((n) => n.full).length;
console.log(`${NODES.length} nodes (${full} full, ${NODES.length - full} outline) · ${PROJECTS.length} projects · ${STAGES.length} capstone stages · ${DIAGNOSTIC.length} diagnostic questions · ${urls.size} unique doc URLs`);
warns.forEach((w) => console.log('  warn:', w));
errors.forEach((e) => console.log('  ERROR:', e));
console.log(errors.length ? `\n${errors.length} error(s)` : '\nOK');
if (process.argv.includes('--urls')) console.log([...urls].join('\n'));
process.exit(errors.length ? 1 : 0);
