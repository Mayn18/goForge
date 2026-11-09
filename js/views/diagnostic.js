import { h, toast } from '../dom.js';
import { renderMD, highlight } from '../md.js';
import { DIAGNOSTIC, diagnosticNodes } from '../../data/diagnostic.js';
import { NODE_MAP } from '../../data/nodes.js';
import { get, commit, nodeRec, log } from '../store.js';
import { nodeLink, pips } from '../ui.js';

function grade(answers) {
  const correct = {}; DIAGNOSTIC.forEach((q) => { correct[q.id] = answers[q.id] === q.a; });
  return correct;
}
function seedNodes(correct) {
  const byNode = {}; DIAGNOSTIC.forEach((q) => { (byNode[q.node] ||= []).push(correct[q.id]); });
  for (const [id, arr] of Object.entries(byNode)) {
    if (!NODE_MAP[id]) continue;
    const r = nodeRec(id);
    if (arr.every(Boolean)) r.seed = 'diagnostic'; else if (r.seed === 'diagnostic') delete r.seed;
  }
}

function results(root, d) {
  const total = DIAGNOSTIC.length; const ok = Object.values(d.correct).filter(Boolean).length;
  const missed = DIAGNOSTIC.filter((q) => !d.correct[q.id]); const seeded = [...new Set(DIAGNOSTIC.map((q) => q.node))].filter((id) => get().nodes[id]?.seed === 'diagnostic');
  root.replaceChildren(h('div', { class: 'wrap' },
    h('div', { class: 'page-head' }, h('h1', {}, `Diagnostic: ${ok} of ${total}`), h('p', {}, 'This is a map, not a grade. Skills you answered fully correctly start as Practiced; the rest are queued under Revisit.')),
    seeded.length ? h('div', { class: 'card' }, h('h3', {}, 'Skills credited as practiced'), h('ul', { class: 'list-clean' }, seeded.map((id) => h('li', {}, nodeLink(id))))) : h('div', { class: 'banner' }, 'No skill was answered fully correctly, which is a perfectly fine place to start.'),
    h('h2', { style: { marginTop: '28px' } }, missed.length ? 'Review what you missed' : 'Nothing missed'),
    missed.map((q) => h('div', { class: 'card diag-q' }, h('div', { class: 'row', style: { gap: '10px' } }, pips(q.lv), nodeLink(q.node, false)), h('div', { class: 'prose', html: renderMD(q.q) }),
      q.code ? h('pre', { 'data-lang': 'go', html: `<code>${highlight(q.code, 'go')}</code>` }) : null,
      h('p', {}, h('strong', {}, 'Your answer: '), d.answers[q.id] == null ? '(skipped)' : q.opts[d.answers[q.id]]), h('p', {}, h('strong', {}, 'Correct: '), q.opts[q.a]), h('div', { class: 'prose small', html: renderMD(q.why) }))),
    h('div', { class: 'row', style: { gap: '10px', marginTop: '20px' } }, h('a', { class: 'btn', href: '#/tree' }, 'Open the skill tree'), h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { const d2 = get(); d2.diagnostic = null; commit(); location.hash = '#/diagnostic'; render(root); } }, 'Retake'))));
}

function render(root) {
  const d = get().diagnostic;
  if (d) return results(root, d);
  const answers = {};
  const form = h('form', { class: 'wrap', onSubmit: (e) => {
    e.preventDefault();
    const correct = grade(answers);
    const st = get(); st.diagnostic = { date: Date.now(), answers: { ...answers }, correct, nodes: diagnosticNodes() };
    seedNodes(correct); log('diagnostic', '', `Diagnostic: ${Object.values(correct).filter(Boolean).length}/${DIAGNOSTIC.length}`); commit(); toast('Diagnostic saved'); results(root, st.diagnostic);
  } },
  h('div', { class: 'page-head' }, h('h1', {}, 'Diagnostic assessment'), h('p', {}, `${DIAGNOSTIC.length} questions, roughly 15 minutes, across the language, HTTP, databases, concurrency and testing. Do not look anything up and do not guess wildly: "I don't know" is useful data. Nothing here is graded against you.`)),
  DIAGNOSTIC.map((q, i) => h('fieldset', { class: 'card diag-q', style: { border: '1px solid var(--line)' } },
    h('legend', { class: 'small muted' }, `Question ${i + 1} of ${DIAGNOSTIC.length}`),
    h('div', { class: 'prose', html: renderMD(q.q) }), q.code ? h('pre', { 'data-lang': 'go', html: `<code>${highlight(q.code, 'go')}</code>` }) : null,
    h('div', { class: 'diag-opts' }, [...q.opts, "I don't know"].map((o, k) => { const idx = k === q.opts.length ? -1 : k; return h('label', {}, h('input', { type: 'radio', name: q.id, value: idx, onChange: () => { answers[q.id] = idx; } }), h('span', {}, o)); })))),
  h('div', { class: 'row', style: { gap: '10px' } }, h('button', { class: 'btn', type: 'submit' }, 'Submit and see results'), h('span', { class: 'small muted' }, 'Unanswered questions count as "don\'t know".')));
  root.replaceChildren(form);
}

export default function diagnostic(root) { document.title = 'Diagnostic · GoForge'; render(root); }
