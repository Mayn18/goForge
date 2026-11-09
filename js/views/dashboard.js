import { h, fmtTime, toast, pct } from '../dom.js';
import { BRANCHES } from '../../data/branches.js';
import { NODES } from '../../data/nodes.js';
import { get, exportJSON, importJSON, reset, commit } from '../store.js';
import { overall, branchStats, recommendations, weakSpots } from '../progress.js';
import { ring, nodeLink, pips, statusChip } from '../ui.js';

export default function dashboard(root) {
  document.title = 'GoForge · Go backend engineering curriculum';
  const o = overall(); const st = get();
  const nextUp = recommendations(5); const weak = weakSpots();
  const done = o.practiced + o.mastered;
  const hero = h('section', { class: 'hero' },
    h('div', {}, h('h1', {}, 'Become the engineer who can build, debug and ship a Go backend alone.'),
      h('p', {}, 'A documentation-first skill tree with graded checks, real projects, and a capstone you build yourself. Everything is stored in your browser. No accounts, no server.'),
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '18px' } },
        st.diagnostic ? h('a', { class: 'btn', href: '#/tree' }, 'Open the skill tree') : h('a', { class: 'btn', href: '#/diagnostic' }, 'Start with the diagnostic'),
        h('a', { class: 'btn btn--ghost', href: st.diagnostic ? '#/diagnostic' : '#/tree' }, st.diagnostic ? 'Retake diagnostic' : 'Skip to the tree'),
        h('a', { class: 'btn btn--ghost', href: '#/guide' }, 'How this works'))),
    h('div', { class: 'card' }, h('div', { class: 'row', style: { gap: '18px' } }, ring(pct(done, o.total), 'var(--ember)'),
      h('div', {}, h('div', { class: 'stat' }, `${done}/${o.total}`, h('small', {}, 'skills practiced or mastered')))),
      h('p', { class: 'small muted', style: { marginTop: '12px' } }, `${o.mastered} mastered · ${o.in_progress} in progress · ${o.full} full lessons, ${o.total - o.full} outlines`)));

  const next = h('div', { class: 'card' }, h('h3', {}, 'Next up'),
    nextUp.length ? h('ul', { class: 'list-clean' }, nextUp.map((n) => h('li', { class: 'row', style: { gap: '10px', justifyContent: 'space-between', padding: '5px 0' } }, nodeLink(n.id, false), h('span', { class: 'row', style: { gap: '8px' } }, pips(n.lv), h('span', { class: `tag${n.full ? '' : ' tag--outline'}` }, n.full ? 'lesson' : 'outline'))))) : h('p', { class: 'muted' }, 'Nothing queued. Pick any skill from the tree.'));

  const revisit = h('div', { class: 'card' }, h('h3', {}, 'Revisit'), weak.length ? h('ul', { class: 'list-clean' }, weak.slice(0, 8).map((w) => h('li', { style: { padding: '4px 0' } }, nodeLink(w.id, false), h('span', { class: 'small muted' }, ` · ${w.detail}`)))) : h('p', { class: 'muted small' }, 'Missed knowledge-check questions and wrong diagnostic answers collect here.'));

  const branches = h('div', { class: 'grid' }, BRANCHES.map((b) => { const s = branchStats(b.id);
    return h('a', { class: 'card card--link', href: `#/tree?b=${b.id}`, style: { textDecoration: 'none', color: 'inherit' } },
      h('div', { class: 'row', style: { gap: '14px' } }, ring(s.pct, b.color), h('div', {}, h('h3', { style: { margin: 0 } }, `${b.id} · ${b.name}`), h('p', { class: 'small muted', style: { margin: '4px 0 0' } }, `${s.done}/${s.total} done · ${s.full} full lesson${s.full === 1 ? '' : 's'}`))));
  }));

  const hist = h('div', { class: 'card' }, h('h3', {}, 'Recent activity'), st.history.length ? h('ul', { class: 'timeline' }, st.history.slice(0, 10).map((e) => h('li', {}, e.label, h('span', { class: 'small muted' }, ` · ${fmtTime(e.t)}`)))) : h('p', { class: 'muted small' }, 'Nothing yet.'));

  const full = NODES.filter((n) => n.full);
  const honest = h('div', { class: 'card' }, h('h3', {}, 'What is complete, and what is not'),
    h('p', { class: 'small' }, `${full.length} of ${NODES.length} skills have a full ten-section lesson with graded checks. The other ${NODES.length - full.length} are mapped outlines with official documentation and self-attested progress. This is deliberate: depth first, honesty about the rest.`),
    h('ul', { class: 'list-clean small' }, full.map((n) => h('li', {}, nodeLink(n.id, true)))));

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (!f) return; try { importJSON(await f.text()); toast('Progress imported'); location.reload(); } catch (err) { toast(err.message); } } });
  const data = h('div', { class: 'card' }, h('h3', {}, 'Your data'), h('p', { class: 'small muted' }, 'Stored only in this browser. Export a backup before clearing site data or switching browsers.'),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn--sm', type: 'button', onClick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })), download: `goforge-progress-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); } }, 'Export'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onClick: () => fileIn.click() }, 'Import'), fileIn,
      h('button', { class: 'btn btn--sm btn--danger', type: 'button', onClick: () => { if (confirm('Erase all GoForge progress in this browser? Export first if unsure.')) { reset(); location.reload(); } } }, 'Reset')));

  root.append(h('div', { class: 'wrap' }, hero, h('div', { class: 'grid', style: { marginBottom: '24px' } }, next, revisit), h('h2', {}, 'Branches'), branches,
    h('div', { class: 'grid', style: { margin: '24px 0' } }, hist, honest), data));
}
