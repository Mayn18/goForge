import { h, words } from '../dom.js';
import { renderMD } from '../md.js';
import { NODE_MAP, NODES } from '../../data/nodes.js';
import { PROJECTS } from '../../data/projects.js';
import { STAGES } from '../../data/capstone.js';
import { LEVELS } from '../../data/branches.js';
import { nodeRec, commit, log } from '../store.js';
import { nodeStatus, unmetEssentials, masteryGates, nodeProgress } from '../progress.js';
import { statusChip, pips, branch, nodeLink, checklist } from '../ui.js';
import { loadLesson, SECTION_ORDER, parseDocLines, parseQA, criteriaItems, splitH3 } from '../lessons.js';
import { toast } from '../dom.js';

const md = (s, extra) => h('div', { class: 'prose', html: renderMD(s, extra) });
const docItem = (d) => h('li', {}, h('span', { class: `tag tag--${d.kind === 'official' ? 'official' : 'supp'}` }, d.kind === 'official' ? 'official' : 'supplementary'),
  h('a', { href: d.url, target: '_blank', rel: 'noopener noreferrer' }, d.title), d.why ? h('span', { class: 'why' }, d.why) : null);

function debounce(fn, ms = 400) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function related(id) {
  const ps = PROJECTS.filter((p) => p.needs.includes(id) || p.rec.includes(id));
  const ss = STAGES.filter((s) => s.nodes.includes(id));
  if (!ps.length && !ss.length) return null;
  return h('div', { class: 'card' }, h('h3', {}, 'Apply it'),
    ss.length ? h('p', { class: 'small muted' }, 'Beep-Bot stages') : null,
    h('ul', { class: 'list-clean' }, ss.map((s) => h('li', {}, h('a', { href: `#/capstone/${s.id}` }, `Stage ${s.n}: ${s.title}`)))),
    ps.length ? h('p', { class: 'small muted' }, 'Standalone projects') : null,
    h('ul', { class: 'list-clean' }, ps.map((p) => h('li', {}, h('a', { href: `#/project/${p.id}` }, p.title)))));
}

function neighbours(id) {
  const n = NODE_MAP[id];
  const unlocks = NODES.filter((x) => x.e.includes(id));
  return h('div', { class: 'card' }, h('h3', {}, 'Neighbourhood'),
    h('p', { class: 'small muted' }, 'Essential before this'), n.e.length ? h('ul', { class: 'list-clean' }, n.e.map((p) => h('li', {}, nodeLink(p)))) : h('p', { class: 'small' }, 'None. Start anywhere.'),
    n.r.length ? [h('p', { class: 'small muted' }, 'Recommended'), h('ul', { class: 'list-clean' }, n.r.map((p) => h('li', {}, nodeLink(p))))] : null,
    unlocks.length ? [h('p', { class: 'small muted' }, 'Unlocks'), h('ul', { class: 'list-clean' }, unlocks.map((p) => h("li", {}, nodeLink(p.id, false))))] : null);
}

function banner(id) {
  const un = unmetEssentials(id);
  if (!un.length || ['practiced', 'mastered'].includes(nodeStatus(id))) return null;
  return h('div', { class: 'banner banner--warn', role: 'note' }, h('strong', {}, 'Exploring ahead. '),
    'Essential prerequisites not yet practiced: ', un.map((p, i) => [i ? ', ' : '', h('a', { href: `#/node/${p}` }, NODE_MAP[p].title)]), '. You can read and work here anyway; expect gaps.');
}

/* ---------------- outline page ---------------- */
function outlinePage(n, root) {
  const r = nodeRec(n.id); const br = branch(n.b);
  const save = debounce(() => { commit(); });
  root.append(h('div', { class: 'wrap' },
    h('div', { class: 'lesson-head' },
      h('div', { class: 'crumbs' }, h('a', { href: '#/tree' }, 'Skill tree'), ' / ', br.name),
      h('h1', {}, n.title),
      h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } }, statusChip(nodeStatus(n.id)), pips(n.lv), h('span', { class: 'small muted' }, `Level ${n.lv}: ${LEVELS[n.lv - 1].name}`), h('span', { class: 'tag tag--outline' }, 'outline: full lesson planned'))),
    banner(n.id),
    h('div', { class: 'stack', style: { marginTop: '22px' } },
      h('div', { class: 'outline-box' },
        h('h2', { style: { marginTop: 0 } }, 'What this skill covers'), h('p', {}, n.s),
        h('p', { class: 'muted small' }, 'This node is mapped into the tree but does not yet have a full ten-section lesson. Work from the official documentation below, then use the checklist to record honestly what you did. Completed lessons are marked in the tree; see docs/EXPANSION.md for how outlines become lessons.')),
      h('div', { class: 'card' }, h('h3', {}, 'Official documentation (start here)'),
        h('ul', { class: 'docs-list' }, n.d.map(([title, url]) => docItem({ kind: 'official', title, url, why: '' })))),
      h('div', { class: 'card' }, h('h3', {}, 'Self-directed practice'),
        h('p', { class: 'small muted' }, 'No lesson means no graded checks, so these are your own commitments. Be strict: "Practiced" should mean you could do it again without the docs open.'),
        h('ul', { class: 'criteria' },
          h('li', {}, h('label', {}, h('input', { type: 'checkbox', checked: !!r.started, onChange: (e) => { r.started = e.target.checked; if (r.started) log('start', n.id, `Started ${n.title}`); commit(); } }), h('span', {}, 'I read the documentation above and started working on this skill.'))),
          h('li', {}, h('label', {}, h('input', { type: 'checkbox', checked: !!r.selfCovered, onChange: (e) => { r.selfCovered = e.target.checked; if (r.selfCovered) { r.started = true; log('practiced', n.id, `Practiced ${n.title} (self-attested)`); } commit(); toast(r.selfCovered ? 'Marked as practiced' : 'Unmarked'); } }), h('span', {}, 'I built something that uses this skill and can explain how and why it works. (Marks the node Practiced.)'))),
          h('li', {}, h('p', { class: 'small muted', style: { margin: 0, padding: '2px 4px' } }, 'Outline nodes cannot reach Mastered: mastery requires the graded checks a full lesson provides.')))),
      h('div', { class: 'card' }, h('h3', {}, 'Your notes'),
        h('textarea', { rows: 6, placeholder: 'What did you learn? What confused you? Links, snippets, questions…', 'aria-label': 'Notes', value: r.notes || '', onInput: (e) => { r.notes = e.target.value; save(); } })),
      neighbours(n.id), related(n.id))));
}

/* ---------------- full lesson ---------------- */
function sectionEl(i, title, kids) {
  const id = `sec-${i}`;
  return h('section', { class: 'section', id, 'aria-labelledby': `${id}-h` }, h('h2', { id: `${id}-h` }, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), title), kids);
}

async function fullPage(n, root) {
  let lesson;
  try { lesson = await loadLesson(n.id); } catch (e) { root.append(h('div', { class: 'wrap' }, h('div', { class: 'banner banner--warn' }, `Could not load this lesson: ${e.message}. Serve the folder over HTTP (see README).`))); return; }
  const r = nodeRec(n.id); const br = branch(n.b);
  if (!r.opened) { r.opened = Date.now(); log('open', n.id, `Opened ${n.title}`); commit(); }
  const save = debounce(() => commit());
  const tocLinks = []; const refreshers = [];
  const section = (title) => lesson.byTitle[title];

  const body = h('article', { class: 'lesson__main' });
  const head = h('div', { class: 'lesson-head' },
    h('div', { class: 'crumbs' }, h('a', { href: '#/tree' }, 'Skill tree'), ' / ', br.name),
    h('h1', {}, n.title),
    h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } }, h('span', { id: 'st-chip' }, statusChip(nodeStatus(n.id))), pips(n.lv), h('span', { class: 'small muted' }, `Level ${n.lv}: ${LEVELS[n.lv - 1].name}`),
      lesson.meta.go ? h('span', { class: 'tag' }, `Go ${lesson.meta.go}`) : null, lesson.meta.time ? h('span', { class: 'tag' }, `~${lesson.meta.time}`) : null));
  body.append(head, banner(n.id));

  const updateChrome = () => {
    const chip = body.querySelector('#st-chip'); if (chip) chip.replaceChildren(statusChip(nodeStatus(n.id)));
    refreshers.forEach((f) => f());
  };
  const touch = () => { commit(); updateChrome(); };

  SECTION_ORDER.forEach((title, i) => {
    const s = section(title); if (!s) { body.append(sectionEl(i, title, h('div', { class: 'banner banner--warn' }, 'This section is missing from the lesson file.'))); return; }
    let kids;
    if (title === 'Official documentation') {
      const { docs, rest } = parseDocLines(s.md);
      kids = [rest ? md(rest) : null, h('ul', { class: 'docs-list' }, docs.map(docItem))];
    } else if (title === 'Hands-on exercises') {
      const { intro, items } = splitH3(s.md);
      kids = [intro ? md(intro) : null, items.map((it, k) => {
        const num = k + 1; const done = !!r.ex[num];
        const card = h('div', { class: `task${done ? ' done' : ''}` });
        const cb = h('input', { type: 'checkbox', checked: done, onChange: (e) => { r.ex[num] = e.target.checked; card.classList.toggle('done', e.target.checked); if (e.target.checked) log('exercise', n.id, `Exercise ${num} · ${n.title}`); touch(); } });
        card.append(h('div', { class: 'task__head' }, h('h3', {}, it.title), h('label', { class: 'check' }, cb, 'Done')), md(it.md, { idPrefix: `ex${num}-` }));
        return card;
      })];
    } else if (title === 'Engineering challenge') {
      const card = h('div', { class: `task challenge${r.ch ? ' done' : ''}` });
      const cb = h('input', { type: 'checkbox', checked: !!r.ch, onChange: (e) => { r.ch = e.target.checked; if (r.ch) log('challenge', n.id, `Challenge · ${n.title}`); touch(); } });
      card.append(md(s.md), h('div', { class: 'task__head', style: { marginTop: '12px' } }, h('label', { class: 'check' }, cb, 'I completed the challenge and checked every constraint')));
      kids = card;
    } else if (title === 'Knowledge check') {
      const { intro, items } = splitH3(s.md);
      kids = [intro ? md(intro) : null, items.map((it, k) => {
        const num = k + 1; const { q, a } = parseQA(it.md);
        const box = h('div', { class: `q ${r.quiz[num] || ''}` });
        const ans = h('div', { class: 'q__ans', hidden: true }, md(a));
        const grade = h('div', { class: 'q__grade', hidden: true });
        const setGrade = (v) => { r.quiz[num] = v; box.className = `q ${v}`; log('quiz', n.id, `Knowledge check ${num} · ${v === 'ok' ? 'got it' : 'missed'}`); touch(); paint(); };
        const paint = () => { grade.replaceChildren(h('span', { class: 'small muted' }, 'Honest self-grade (write your answer first):'),
          h('button', { class: 'btn btn--sm', type: 'button', 'aria-pressed': r.quiz[num] === 'ok', onClick: () => setGrade('ok') }, r.quiz[num] === 'ok' ? '✓ I had it' : 'I had it'),
          h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-pressed': r.quiz[num] === 'miss', onClick: () => setGrade('miss') }, r.quiz[num] === 'miss' ? '✗ Missed it' : 'I missed it')); };
        paint();
        const ta = h('textarea', { rows: 3, placeholder: 'Write your answer before revealing…', 'aria-label': `Your answer to question ${num}` });
        const reveal = h('button', { class: 'btn btn--sm', type: 'button', onClick: () => { ans.hidden = false; grade.hidden = false; reveal.hidden = true; } }, 'Reveal answer');
        if (r.quiz[num]) { ans.hidden = false; grade.hidden = false; reveal.hidden = true; }
        box.append(h('strong', {}, `Question ${num}`), md(q), ta, h('div', { style: { marginTop: '8px' } }, reveal), ans, grade);
        return box;
      })];
    } else if (title === 'Mastery criteria') {
      const items = criteriaItems(s.md); const pre = s.md.split('\n').filter((l) => !/^-\s+/.test(l)).join('\n').trim();
      const gateBox = h('div', { class: 'mastery-box' });
      const teach = h('textarea', { rows: 6, placeholder: 'Explain this skill to a colleague who has never seen it: what it is, how it works, where it bites. At least 40 words, your own words.', 'aria-label': 'Teach-back', value: r.teach || '', onInput: (e) => { r.teach = e.target.value; wc.textContent = `${words(r.teach)} words`; save(); setTimeout(paintGates, 450); } });
      const wc = h('span', { class: 'small muted' }, `${words(r.teach || '')} words`);
      const paintGates = () => {
        const g = masteryGates(n.id); const claimed = !!r.mastered;
        const claim = h('button', { class: 'btn', type: 'button', disabled: !g.eligible || claimed, onClick: () => { r.mastered = Date.now(); log('mastered', n.id, `Mastered ${n.title}`); toast(`Mastered: ${n.title}`); touch(); } }, claimed ? 'Mastered ✓' : 'Claim mastery');
        gateBox.replaceChildren(h('h3', { style: { marginTop: 0 } }, 'Mastery'), h('p', { class: 'small muted' }, 'Mastered is claimed, not given. Every gate must pass.'),
          h('ul', { class: 'gate' }, g.gates.map((x) => h('li', { class: x.ok ? 'ok' : '' }, x.label))), claim,
          claimed ? h('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: '8px' }, type: 'button', onClick: () => { r.mastered = 0; touch(); } }, 'Withdraw claim') : null);
      };
      refreshers.push(paintGates); paintGates();
      kids = [pre ? md(pre) : null, checklist(items, r.cr, (k, v) => { r.cr[k] = v; touch(); }),
        h('h3', {}, 'Teach-back'), teach, h('div', { style: { margin: '4px 0 16px' } }, wc), gateBox];
    } else kids = md(s.md);
    const el = sectionEl(i, title, kids);
    body.append(el); tocLinks.push([title, el.id, title]);
  });

  const toc = h('nav', { class: 'toc', 'aria-label': 'On this page' }, h('ol', {}, tocLinks.map(([t, id]) => h('li', {}, h('a', { href: `#/node/${n.id}`, 'data-sec': id, onClick: (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t)))));
  const markToc = () => { const doneFor = { 'Hands-on exercises': Object.values(r.ex).filter(Boolean).length >= n.full.ex, 'Engineering challenge': !!r.ch, 'Knowledge check': Object.keys(r.quiz).length >= n.full.q, 'Mastery criteria': Object.values(r.cr).filter(Boolean).length >= n.full.cr };
    toc.querySelectorAll('a').forEach((a, i) => a.classList.toggle('done', !!doneFor[tocLinks[i][0]])); };
  refreshers.push(markToc); markToc();

  const prog = h('div', { class: 'card' });
  const paintProg = () => { const p = nodeProgress(n.id); prog.replaceChildren(h('h3', {}, 'Your progress'), h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': p.done, 'aria-valuemax': p.total }, h('i', { style: { width: `${p.total ? (p.done / p.total) * 100 : 0}%` } })), h('p', { class: 'small muted' }, `${p.done} of ${p.total} items`)); };
  refreshers.push(paintProg); paintProg();

  const notes = h('div', { class: 'card' }, h('h3', {}, 'Notes'), h('textarea', { rows: 6, placeholder: 'Your notes autosave locally.', 'aria-label': 'Notes', value: r.notes || '', onInput: (e) => { r.notes = e.target.value; save(); } }));
  root.append(h('div', { class: 'lesson' }, toc, body, h('aside', { class: 'lesson__side-r', 'aria-label': 'Lesson sidebar' }, prog, notes, neighbours(n.id), related(n.id))));

  // scrollspy
  const links = [...toc.querySelectorAll('a')];
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.dataset.sec === e.target.id)); }), { rootMargin: '-20% 0px -70% 0px' });
  body.querySelectorAll('.section').forEach((s) => io.observe(s));
  return () => io.disconnect();
}

export default async function lessonView(root, { id }) {
  const n = NODE_MAP[id];
  if (!n) { root.append(h('div', { class: 'wrap' }, h('h1', {}, 'No such skill'), h('p', {}, h('a', { href: '#/tree' }, 'Back to the skill tree')))); return; }
  document.title = `${n.title} · GoForge`;
  if (!n.full) { outlinePage(n, root); return; }
  return fullPage(n, root);
}
