// A small, safe Markdown renderer + syntax highlighter (no dependencies, no raw HTML passthrough).
import { esc, slug } from './dom.js';

/* ---------- front matter and sections ---------- */
export function parseFront(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { meta, body: text.slice(m[0].length) };
}
/** Split on level-2 headings, ignoring ``` fences. */
export function splitSections(body) {
  const out = []; let cur = { title: '', lines: [] }, fence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && /^##\s+(.+)$/.exec(line);
    if (m) { out.push(cur); cur = { title: m[1].trim(), lines: [] }; } else cur.lines.push(line);
  }
  out.push(cur);
  return out.filter((s) => s.title || s.lines.join('').trim()).map((s) => ({ title: s.title, md: s.lines.join('\n').trim() }));
}
/** Split a section into level-3 chunks: [{title, md}] (ignores fences). */
export function splitH3(md) {
  const out = []; let cur = null, fence = false; const pre = [];
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && /^###\s+(.+)$/.exec(line);
    if (m) { cur = { title: m[1].trim(), lines: [] }; out.push(cur); } else if (cur) cur.lines.push(line); else pre.push(line);
  }
  return { intro: pre.join('\n').trim(), items: out.map((c) => ({ title: c.title, md: c.lines.join('\n').trim() })) };
}

/* ---------- inline ---------- */
export function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]*|\.{0,2}\/[^)\s]*)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u);
    return `<a href="${u.replace(/&amp;/g, '&')}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

/* ---------- blocks ---------- */
const CALLOUTS = { PITFALL: 'Common mistake', TIP: 'Tip', NOTE: 'Note', GO: 'Go detail' };
export function renderMD(md, opts = {}) {
  const lines = md.replace(/\r\n/g, '\n').split('\n'); const out = []; let i = 0;
  const isBlockStart = (l) => /^(```|#{1,4}\s|>|\s*[-*]\s|\s*\d+[.)]\s|---+$|\|)/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)\s*$/.exec(line))) {
      const lang = m[1] || 'text'; const buf = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const code = buf.join('\n');
      out.push(lang === 'diagram' ? `<pre class="diagram" aria-label="Diagram"><code>${esc(code)}</code></pre>` : `<pre data-lang="${esc(lang)}"><code>${highlight(code, lang)}</code></pre>`);
    } else if ((m = /^(#{1,4})\s+(.+)$/.exec(line))) {
      const lv = m[1].length; out.push(`<h${lv} id="${opts.idPrefix || ''}${slug(m[2])}">${inline(m[2])}</h${lv}>`); i++;
    } else if (/^---+$/.test(line)) { out.push('<hr>'); i++;
    } else if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      let cls = '', title = '';
      const t = /^\[!(\w+)\]\s*/.exec(buf[0] || '');
      if (t && CALLOUTS[t[1]]) { cls = t[1].toLowerCase(); title = CALLOUTS[t[1]]; buf[0] = buf[0].slice(t[0].length); }
      out.push(`<blockquote class="${cls}">${title ? `<span class="callout-title">${title}</span>` : ''}${renderMD(buf.join('\n'), opts)}</blockquote>`);
    } else if (/^\|/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line); const base = line.match(/^\s*/)[0].length; const items = [];
      while (i < lines.length) {
        const l = lines[i]; const mm = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(l);
        if (mm && mm[1].length <= base) { items.push([mm[3]]); i++; }
        else if (items.length && l.trim() && /^\s+/.test(l)) { items.at(-1).push(l.replace(new RegExp(`^\\s{0,${base + 2}}`), '')); i++; }
        else if (items.length && !l.trim() && /^\s+\S/.test(lines[i + 1] || '')) { items.at(-1).push(''); i++; }
        else break;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((it) => `<li>${renderItem(it, opts)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else {
      const buf = [line]; i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}
function renderItem(parts, opts) {
  const html = renderMD(parts.join('\n'), opts);
  return /^<p>[\s\S]*<\/p>$/.test(html) && (html.match(/<p>/g) || []).length === 1 ? html.slice(3, -4) : html;
}

/* ---------- syntax highlighting ---------- */
const GO_KW = new Set('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var'.split(' '));
const GO_T = new Set('any bool byte comparable complex128 complex64 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr'.split(' '));
const GO_B = new Set('append cap clear close complex copy delete imag len make max min new panic print println real recover true false nil iota'.split(' '));
const SQL_KW = new Set('select from where insert into values update set delete create table index unique primary key foreign references on conflict do nothing join left right inner outer full cross using group by order having limit offset as and or not null is in exists begin commit rollback returning default constraint check alter add column drop explain analyze with for share serializable repeatable read committed isolation level transaction distinct union all case when then else end like ilike cascade view if'.split(' '));
const SH_KW = new Set('if then else fi for do done while case esac function export cd echo go docker git curl sudo'.split(' '));
const SPECS = {
  go: { kw: GO_KW, ty: GO_T, bi: GO_B, com: '//[^\\n]*|/\\*[\\s\\S]*?\\*/', str: '`[^`]*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])\'' },
  sql: { kw: SQL_KW, ty: new Set('int integer bigint serial bigserial text varchar boolean timestamptz timestamp uuid jsonb date numeric'.split(' ')), bi: new Set(['now', 'count', 'sum', 'true', 'false']), com: '--[^\\n]*|/\\*[\\s\\S]*?\\*/', str: "'(?:''|[^'])*'", ci: true },
  bash: { kw: SH_KW, ty: new Set(), bi: new Set(), com: '#[^\\n]*', str: '"(?:\\\\.|[^"\\\\])*"|\'[^\']*\'' },
  json: { kw: new Set(), ty: new Set(), bi: new Set(['true', 'false', 'null']), com: '(?!)', str: '"(?:\\\\.|[^"\\\\\\n])*"' },
  yaml: { kw: new Set(), ty: new Set(), bi: new Set(['true', 'false', 'null']), com: '#[^\\n]*', str: '"(?:\\\\.|[^"\\\\])*"|\'[^\']*\'' },
};
SPECS.sh = SPECS.shell = SPECS.powershell = SPECS.bash; SPECS.text = null;
const cache = {};
export function highlight(code, lang) {
  const sp = SPECS[lang]; if (!sp) return esc(code);
  const re = (cache[lang] ||= new RegExp(`(${sp.com})|(${sp.str})|(\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b|0x[\\da-fA-F_]+)|([A-Za-z_][A-Za-z0-9_]*)`, 'g'));
  re.lastIndex = 0; let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index)); last = re.lastIndex;
    const [tok, c, s, n, w] = m;
    if (c) out += `<span class="tk-c">${esc(tok)}</span>`;
    else if (s) out += `<span class="tk-s">${esc(tok)}</span>`;
    else if (n) out += `<span class="tk-n">${esc(tok)}</span>`;
    else {
      const key = sp.ci ? w.toLowerCase() : w;
      if (sp.kw.has(key)) out += `<span class="tk-k">${esc(tok)}</span>`;
      else if (sp.ty.has(key)) out += `<span class="tk-t">${esc(tok)}</span>`;
      else if (sp.bi.has(key)) out += `<span class="tk-b">${esc(tok)}</span>`;
      else if (lang === 'go' && code[re.lastIndex] === '(') out += `<span class="tk-f">${esc(tok)}</span>`;
      else out += esc(tok);
    }
  }
  return out + esc(code.slice(last));
}
