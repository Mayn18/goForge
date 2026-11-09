import { h } from '../dom.js';
import { renderMD } from '../md.js';

export default async function guide(root) {
  document.title = 'Guide · GoForge';
  let text = '';
  try { const r = await fetch('content/guide.md'); text = r.ok ? await r.text() : 'The guide file could not be loaded.'; } catch { text = 'The guide file could not be loaded. Serve the folder over HTTP (see README).'; }
  root.append(h('div', { class: 'wrap', style: { maxWidth: '820px' } }, h('div', { class: 'prose', html: renderMD(text) })));
}
