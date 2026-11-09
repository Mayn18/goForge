import { h, pct } from '../dom.js';
import { inline } from '../md.js';
import { PROJECTS, PROJECT_MAP } from '../../data/projects.js';
import { LEVELS } from '../../data/branches.js';
import { projRec, commit, log } from '../store.js';
import { nodeLink, pips, checklist } from '../ui.js';
import { satisfied } from '../progress.js';

const STYLE = { guided: 'Guided', semi: 'Semi-guided', open: 'Open-ended' };
const count = (o) => Object.values(o || {}).filter(Boolean).length;

export function projectList(root) {
  document.title = 'Projects · GoForge';
  root.append(h('div', { class: 'wrap' }, h('div', { class: 'page-head' }, h('h1', {}, 'Standalone projects'), h('p', {}, 'Small, finishable systems with real requirements and testable acceptance criteria. Guided ones tell you the steps; open-ended ones tell you the problem. You write all the code.')),
    h('div', { class: 'grid' }, PROJECTS.map((p) => { const r = projRec(p.id); const ms = count(r.ms), ac = count(r.ac);
      const ready = p.needs.filter((n) => !satisfied(n)).length;
      return h('a', { class: 'card card--link', href: `#/project/${p.id}`, style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, h('span', { class: 'tag' }, STYLE[p.style]), pips(p.level), h('span', { class: 'small muted' }, `${p.hours} h`)),
        h('h3', {}, p.title), h('p', { class: 'small muted' }, p.tagline),
        h('div', { class: 'bar' }, h('i', { style: { width: `${pct(ac, p.acceptance.length)}%` } })),
        h('p', { class: 'small muted' }, `${ac}/${p.acceptance.length} acceptance checks · ${ms}/${p.milestones.length} milestones`),
        ready ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, `${ready} prerequisite skill${ready > 1 ? 's' : ''} not yet practiced`) : null);
    }))));
}

export function projectDetail(root, { id }) {
  const p = PROJECT_MAP[id];
  if (!p) { root.append(h('div', { class: 'wrap' }, h('h1', {}, 'No such project'), h('a', { href: '#/projects' }, 'All projects'))); return; }
  document.title = `${p.title} · GoForge`;
  const r = projRec(id); let tmr;
  const sec = (t, kids) => h('section', { class: 'section' }, h('h2', {}, t), kids);
  const ul = (a) => h('ul', {}, a.map((t) => h('li', { html: inline(t) })));
  root.append(h('div', { class: 'wrap' },
    h('div', { class: 'lesson-head' }, h('div', { class: 'crumbs' }, h('a', { href: '#/projects' }, 'Projects')), h('h1', {}, p.title), h('p', { class: 'muted' }, p.tagline),
      h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap' } }, h('span', { class: 'tag' }, STYLE[p.style]), pips(p.level), h('span', { class: 'small muted' }, `Level ${p.level}: ${LEVELS[p.level - 1].name} · ${p.hours} h`))),
    h('div', { class: 'prose' },
      sec('Skills you need', [h('p', { class: 'small muted' }, 'Essential:'), h('ul', { class: 'list-clean' }, p.needs.map((n) => h('li', {}, nodeLink(n)))), p.rec.length ? [h('p', { class: 'small muted' }, 'Recommended:'), h('ul', { class: 'list-clean' }, p.rec.map((n) => h('li', {}, nodeLink(n))))] : null]),
      sec('Requirements', ul(p.requirements)), sec('Constraints', ul(p.constraints)),
      sec('Milestones', checklist(p.milestones, r.ms, (k, v) => { r.ms[k] = v; if (v) log('milestone', id, `${p.title}: milestone ${k}`); commit(); })),
      sec('Acceptance criteria', [h('p', { class: 'small muted' }, 'Check one only after you have demonstrated it with a test or a reproducible command.'), checklist(p.acceptance, r.ac, (k, v) => { r.ac[k] = v; if (v) log('acceptance', id, `${p.title}: acceptance ${k}`); commit(); })]),
      sec('Decisions to make and write down', ul(p.decisions)), sec('Optional extensions', ul(p.extensions)),
      sec('Notes', h('textarea', { rows: 6, placeholder: 'Design notes, decisions, what went wrong…', 'aria-label': 'Project notes', value: r.notes || '', onInput: (e) => { r.notes = e.target.value; clearTimeout(tmr); tmr = setTimeout(commit, 400); } })))));
}
