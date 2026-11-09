import { h, pct } from '../dom.js';
import { BEEPBOT, STAGES, STAGE_MAP } from '../../data/capstone.js';
import { LEVELS } from '../../data/branches.js';
import { capRec, commit, log } from '../store.js';
import { nodeLink, pips, checklist } from '../ui.js';

const count = (o) => Object.values(o || {}).filter(Boolean).length;
const code = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/`([^`]+)`/g, '<code>$1</code>');

export function capstoneView(root) {
  document.title = 'Beep-Bot capstone · GoForge';
  const total = STAGES.reduce((a, s) => a + s.acceptance.length, 0); const done = STAGES.reduce((a, s) => a + count(capRec(s.id).ac), 0);
  root.append(h('div', { class: 'wrap' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Capstone: build the Beep-Bot backend'), h('p', { html: code(BEEPBOT.intro) })),
    h('div', { class: 'card' }, h('div', { class: 'bar' }, h('i', { style: { width: `${pct(done, total)}%` } })), h('p', { class: 'small muted' }, `${done}/${total} acceptance checks across ${STAGES.length} stages · `, h('a', { href: BEEPBOT.repo, target: '_blank', rel: 'noopener noreferrer' }, 'Beep-Bot repository'))),
    h('div', { class: 'card', style: { margin: '16px 0' } }, h('h3', {}, 'Ground rules'), h('ul', {}, BEEPBOT.rules.map((t) => h('li', { html: code(t) })))),
    h('details', { class: 'fold' }, h('summary', {}, BEEPBOT.contract.title), h('div', { class: 'prose', html: `<p>${code(BEEPBOT.contract.body)}</p>` })),
    h('div', { class: 'stack', style: { marginTop: '22px' } }, STAGES.map((s) => { const r = capRec(s.id);
      return h('a', { class: 'card card--link stage', href: `#/capstone/${s.id}`, style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } }, h('span', { class: 'stage__n' }, `STAGE ${s.n}`), pips(s.level)), h('h3', {}, s.title), h('p', { class: 'small muted' }, s.goal),
        h('p', { class: 'small muted' }, `${count(r.ac)}/${s.acceptance.length} acceptance checks`));
    }))));
}

export function stageView(root, { id }) {
  const s = STAGE_MAP[id];
  if (!s) { root.append(h('div', { class: 'wrap' }, h('h1', {}, 'No such stage'), h('a', { href: '#/capstone' }, 'Capstone'))); return; }
  document.title = `Stage ${s.n} · GoForge`;
  const r = capRec(id); let tmr; const save = () => { clearTimeout(tmr); tmr = setTimeout(commit, 400); };
  const sec = (t, k) => h('section', { class: 'section' }, h('h2', {}, t), k);
  const ul = (a) => h('ul', {}, a.map((t) => h('li', { html: code(t) })));
  const prev = STAGES[s.n - 1], next = STAGES[s.n + 1];
  root.append(h('div', { class: 'wrap' },
    h('div', { class: 'lesson-head' }, h('div', { class: 'crumbs' }, h('a', { href: '#/capstone' }, 'Beep-Bot capstone')), h('h1', {}, `Stage ${s.n}: ${s.title}`), h('p', { class: 'muted' }, s.goal), h('div', { class: 'row', style: { gap: '12px' } }, pips(s.level), h('span', { class: 'small muted' }, LEVELS[s.level - 1].name))),
    h('div', { class: 'prose' },
      sec('Skills to bring', h('ul', { class: 'list-clean' }, s.nodes.map((n) => h('li', {}, nodeLink(n))))),
      sec('Tasks', checklist(s.tasks, r.ms, (k, v) => { r.ms[k] = v; if (v) log('stage', id, `Stage ${s.n}: task ${k}`); commit(); })),
      sec('Decisions to record', [h('p', { class: 'small muted' }, 'Write a few sentences for each: context, options, choice, consequences.'), s.decisions.map((d, i) => h('div', { class: 'q' }, h('strong', { html: code(d) }), h('textarea', { rows: 3, 'aria-label': `Decision ${i + 1}`, value: r.decisions[i + 1] || '', onInput: (e) => { r.decisions[i + 1] = e.target.value; save(); } })))]),
      sec('Acceptance: how you know you are done', checklist(s.acceptance, r.ac, (k, v) => { r.ac[k] = v; if (v) log('stage', id, `Stage ${s.n}: acceptance ${k}`); commit(); })),
      sec('Notes', h('textarea', { rows: 6, 'aria-label': 'Stage notes', placeholder: 'What you tried, what broke…', value: r.notes || '', onInput: (e) => { r.notes = e.target.value; save(); } })),
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '30px' } }, prev ? h('a', { class: 'btn btn--ghost', href: `#/capstone/${prev.id}` }, `← Stage ${prev.n}`) : h('span'), next ? h('a', { class: 'btn btn--ghost', href: `#/capstone/${next.id}` }, `Stage ${next.n} →`) : h('span')))));
}
