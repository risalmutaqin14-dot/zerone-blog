// cleanHtml mengimpor 'astro:env/server' (tak tersedia di node), jadi pakai stub lewat loader sederhana: uji lewat tsx tidak ada.
// Maka config sanitize-html diuji dengan membaca sumber posts.ts dan mengeksekusi bagian yang relevan.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sanitizeHtml from 'sanitize-html';

const src = readFileSync(new URL('../src/lib/posts.ts', import.meta.url), 'utf8');
const tags = src.match(/allowedTags: (\[[^\]]*\])/)[1];
const attrs = src.match(/allowedAttributes: (\{[^\r\n]*\}),\r?\n/)[1];
const allowedTags = eval(tags);
const allowedAttributes = eval(`(${attrs})`);
const ok = (v) => !!v && /^(?:[1-9]|1\d|20)$/.test(v);
const fixSpan = (tagName, { colspan, rowspan, ...rest }) => ({
  tagName,
  attribs: { ...rest, ...(ok(colspan) ? { colspan } : {}), ...(ok(rowspan) ? { rowspan } : {}) },
});
// Pastikan fixSpan di sumber sama dengan salinan di atas.
assert.ok(src.includes('/^(?:[1-9]|1\\d|20)$/'), 'regex fixSpan di posts.ts berubah');
assert.ok(src.includes('th: fixSpan, td: fixSpan'));

const clean = (h) =>
  sanitizeHtml(h, { allowedTags, allowedAttributes, allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } }, transformTags: { th: fixSpan, td: fixSpan } });

const out = clean('<table onclick="x()" style="width:1px"><thead><tr><th colspan="2" style="color:red">H</th></tr></thead><tbody><tr><td colspan="99" rowspan="3" onclick="x()">a</td><td>b<script>1</script></td></tr></tbody></table>');
assert.ok(out.includes('<table>') && out.includes('<thead>') && out.includes('<tbody>'));
assert.ok(out.includes('<th colspan="2">H</th>'), out);
assert.ok(out.includes('rowspan="3"') && !out.includes('colspan="99"'), out);
assert.ok(!/onclick|style|script/.test(out), out);
console.log('table ok');
