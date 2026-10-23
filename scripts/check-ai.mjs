// node scripts/check-ai.mjs
import assert from 'node:assert/strict';
import { parseBrief, parseBlueprint, checkArticle, referencesMd, parseArticleText, parseOutlineRevise, parseOutlinePatch, reviseOutlinePrompt } from '../src/lib/aiArticle.js';

assert.ok('error' in parseBrief({ brief: 'x' }));
assert.ok('error' in parseBrief({ keyword: 'k' }));
const { data: d } = parseBrief({ keyword: 'IHSG', brief: 'b', related: ['saham', ' '], minWords: 5, language: 'en' });
assert.deepEqual(d.related, ['saham']);
assert.equal(d.minWords, 300); // dijepit ke minimum
assert.equal(d.language, 'English');

assert.deepEqual(d.sources, []);
const s = parseBrief({ keyword: 'k', brief: 'b', sources: '- https://a.com/x\n\n2. Doe (2023). Judul. https://doi.org/1\n   \n' }).data;
assert.deepEqual(s.sources, ['https://a.com/x', 'Doe (2023). Judul. https://doi.org/1']);
assert.equal(referencesMd(d), ''); // tanpa sumber = tanpa section
assert.match(referencesMd(s), /^\n\n## Referensi\n\n- https:\/\/a\.com\/x\n- Doe/);
assert.match(referencesMd({ ...s, language: 'English' }), /## References/);

assert.ok('error' in parseBlueprint({ title: 't' }));
assert.ok('error' in parseBlueprint({ sections: 's' }));
assert.equal(parseBlueprint({ title: 't', sections: 's', meta_description: 'x'.repeat(300) }).data.meta_description.length, 160);

// Keyword wajib ada di H2 (outline + artikel + revisi)
import { outlinePrompt, articlePrompt } from '../src/lib/aiArticle.js';
assert.match(outlinePrompt(d), /H2\) heading must contain the main keyword "IHSG" exactly/);
assert.match(articlePrompt(d, { title: 't', excerpt: 'e', sections: '## A' }), /heading must contain the main keyword "IHSG" exactly/);

// Chat revisi outline
const RB = { keyword: 'IHSG', brief: 'b', blueprint: { title: 'Judul IHSG', sections: '## A\n- x' }, message: 'judul lebih tajam' };
assert.ok('error' in parseOutlineRevise({ ...RB, message: ' ' }));
assert.ok('error' in parseOutlineRevise({ ...RB, keyword: '' }));
assert.ok('error' in parseOutlineRevise({ ...RB, blueprint: { title: 't' } }));
const rvo = parseOutlineRevise({ ...RB, history: [{ role: 'ai', text: 'ok' }, { role: 'user', text: '' }] }).data;
assert.deepEqual([rvo.blueprint.title, rvo.history.length], ['Judul IHSG', 1]);
assert.match(reviseOutlinePrompt(rvo.brief, rvo.blueprint, rvo.message, rvo.history), /Editor says: judul lebih tajam/);
const po = parseOutlinePatch({ reply: 'Sudah.', changes: { title: 'Baru', meta_description: 'x'.repeat(300), foo: 'abaikan', excerpt: '  ' } });
assert.deepEqual([po.patch.title, po.patch.meta_description.length, 'foo' in po.patch, 'excerpt' in po.patch], ['Baru', 160, false, false]);
assert.deepEqual(parseOutlinePatch(null), { reply: 'No changes.', patch: {} });

const words = Array(320).fill('kata').join(' ');
const html = `<p>IHSG hari ini dibahas.</p><h2>Apa itu IHSG</h2><p>${words}</p><h2>B</h2><p>x</p><h2>C</h2><p>saham</p>`;
const ok = checkArticle({ title: 'IHSG hari ini', meta_description: 'a'.repeat(140) }, html, d);
assert.ok(ok.every((c) => c.ok), JSON.stringify(ok.filter((c) => !c.ok)));

const bad = checkArticle({ title: 'x'.repeat(61), meta_description: 'a'.repeat(119) }, '<p>teks</p>', d);
for (const id of ['title-len', 'title-kw', 'meta-len', 'words', 'first-p', 'h2-count', 'h2-kw', 'related']) {
  assert.equal(bad.find((c) => c.id === id).ok, false, id);
}
const t = parseArticleText('===TAGS===\n- seo, blog\n===CLAIMS===\n- Angka 20% perlu dicek\n- none\n===MARKDOWN===\nIntro "kutip".\n\n## A\n\nisi\n===\nsetext');
assert.deepEqual(t.tags, ['seo', 'blog']);
assert.deepEqual(t.claims_to_verify, ['Angka 20% perlu dicek']);
assert.match(t.content_markdown, /^Intro "kutip"\.\n\n## A/);
assert.deepEqual(parseArticleText('===TAGS===\na\n===CLAIMS===\nnone\n===MARKDOWN===\n```markdown\nhalo\n```').content_markdown, 'halo');
assert.equal(parseArticleText('Hanya teks tanpa penanda').content_markdown, 'Hanya teks tanpa penanda'); // model abai format
assert.equal(parseArticleText('').content_markdown, '');
console.log('ai ok');
