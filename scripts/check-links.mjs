#!/usr/bin/env node
// Checks that every documentation URL in the curriculum responds (needs network; Node 18+).
// Usage: node scripts/check-links.mjs            (checks pages)
//        node scripts/check-links.mjs --anchors  (also verifies #fragments exist in the HTML)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urls = execFileSync('node', [join(root, 'scripts/validate.mjs'), '--urls'], { encoding: 'utf8' }).split('\n').filter((l) => l.startsWith('https://'));
const anchors = process.argv.includes('--anchors');
const pages = new Map();
for (const u of urls) { const [base, frag] = u.split('#'); if (!pages.has(base)) pages.set(base, new Set()); if (frag) pages.get(base).add(frag); }
let bad = 0;
const queue = [...pages.entries()];
async function worker() {
  while (queue.length) {
    const [url, frags] = queue.shift();
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'goforge-link-check' }, signal: AbortSignal.timeout(20000) });
      let note = '';
      if (r.status >= 400) { bad++; note = `HTTP ${r.status}`; }
      else if (new URL(r.url).host !== new URL(url).host) note = `redirected to ${r.url}`;
      else if (anchors && frags.size) { const html = await r.text(); for (const f of frags) if (!html.includes(`id="${f}"`) && !html.includes(`name="${f}"`)) { bad++; note += `missing #${f} `; } }
      if (note) console.log(`${url}  ${note}`);
    } catch (e) { bad++; console.log(`${url}  ${e.message}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`${pages.size} pages checked, ${bad} problem(s)`); process.exit(bad ? 1 : 0);
