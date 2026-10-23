// node scripts/check-aiplan.mjs
import assert from 'node:assert/strict';
import { parseGenerate, parseIdeas, parseRevise, parseRevision, planPrompt, revisePrompt, sixMonthsAgo } from '../src/lib/aiPlan.js';

const W = '11111111-1111-4111-8111-111111111111';
const today = '2026-10-23';

assert.ok('error' in parseGenerate({}, today));
assert.ok('error' in parseGenerate({ website_ids: ['x'] }, today));
assert.ok('error' in parseGenerate({ website_ids: [W], from: '2026-10-01' }, today)); // lampau
assert.ok('error' in parseGenerate({ website_ids: [W], from: '2026-10-25', to: '2026-10-24' }, today));
assert.ok('error' in parseGenerate({ website_ids: [W], from: '2026-10-25', to: '2026-12-25' }, today)); // > 31 hari
assert.ok('error' in parseGenerate({ website_ids: [W], from: '2026-02-30' }, today));
const g = parseGenerate({ website_ids: [W, W], per_site: 9 }, today).data;
assert.deepEqual([g.ids.length, g.from, g.to, g.perSite], [1, today, '2026-11-05', 3]);

const ctx = {
  from: '2026-10-26', to: '2026-11-01', perSite: 1,
  categories: [{ id: 'c1', name: 'Tips' }],
  taken: ['Cara Memilih CMS', 'Judul di situs lain'],
  sites: [{ id: W, slug: 'zerone' }],
};
const ideas = parseIdeas({
  ideas: [
    { site: 'zerone', title: 'cara memilih cms!', date: '2026-10-27' }, // sama dgn existing (normalisasi)
    { site: 'zerone', title: 'Judul di situs lain', date: '2026-10-27' }, // kembar lintas situs
    { site: 'zerone', title: 'Migrasi Data: Panduan Lengkap', date: '2030-01-01', category: 'tips', brief: 'b', verify: 'cek aturan' }, // titik dua + tanggal di luar rentang
    { site: 'zerone', title: 'Lewat kuota', date: '2026-10-27' },
    { site: 'asing', title: 'Situs tak dikenal', date: '2026-10-27' },
  ],
}, ctx);
assert.equal(ideas.length, 1);
assert.deepEqual([ideas[0].title, ideas[0].planned_for, ideas[0].category_id, ideas[0].status], ['Migrasi Data, Panduan Lengkap', '2026-10-26', 'c1', 'idea']);
assert.ok(!ideas[0].title.includes(':'));
const plain = parseIdeas({ ideas: [{ site: 'zerone', title: 'Kenapa CMS Anda Lambat? Ini Solusinya - Cepat!', date: '2026-10-27' }] }, ctx);
assert.equal(plain[0].title, 'Kenapa CMS Anda Lambat Ini Solusinya, Cepat'); // ? ! dibuang, tanda pisah jadi koma
assert.match(planPrompt({ today, ...g, categories: [], sites: [{ slug: 'zerone', name: 'Zerone', existing: [] }] }), /NEVER use "\?"/);
assert.equal(sixMonthsAgo('2026-10-23'), '2026-04-23');
assert.equal(sixMonthsAgo('2026-03-31'), '2025-10-01'); // JS meluap: 31 Sep -> 1 Okt, cukup untuk jendela
assert.match(ideas[0].brief, /Perlu verifikasi: cek aturan/);
assert.deepEqual(parseIdeas(null, ctx), []);
assert.match(planPrompt({ today, ...g, categories: ['Tips'], sites: [{ slug: 'zerone', name: 'Zerone', existing: [] }] }), /Readers: business owners/);

// Chat revisi
const R = { message: 'judul #1 lebih tajam', from: '2026-10-26', to: '2026-11-01', ideas: [{ website_id: W, title: 'A', planned_for: '2026-10-27' }] };
assert.ok('error' in parseRevise({ ...R, message: '  ' }));
assert.ok('error' in parseRevise({ ...R, ideas: [] }));
assert.ok('error' in parseRevise({ ...R, ideas: [{ website_id: 'x' }] }));
assert.ok('error' in parseRevise({ ...R, to: '2026-10-01' }));
const rv = parseRevise({ ...R, history: [{ role: 'ai', text: 'ok' }, { role: 'user', text: '' }] }).data;
assert.deepEqual([rv.ideas.length, rv.history.length], [1, 1]);
const rctx = {
  from: '2026-10-26', to: '2026-11-01', categories: [{ id: 'c1', name: 'Tips' }], taken: ['Judul Lama'],
  ideas: [{ title: 'A' }, { title: 'B' }],
};
const rev = parseRevision({
  reply: 'Sudah.',
  changes: [
    { n: 1, title: 'Judul Baru: Lebih Tajam', date: '2030-01-01', category: 'Tips', brief: 'x' }, // titik dua dibuang, tanggal luar rentang diabaikan
    { n: 2, title: 'judul lama!' }, // bentrok 6 bulan
    { n: 9, title: 'Tak ada' }, // card tak ada
  ],
}, rctx);
assert.deepEqual(rev.changes, [{ n: 1, patch: { title: 'Judul Baru, Lebih Tajam', category_id: 'c1', brief: 'x' } }]);
assert.deepEqual(rev.rejected, [2]);
assert.equal(parseRevision(null, rctx).changes.length, 0);
assert.match(revisePrompt({ today, ...rv, categories: ['Tips'], sites: [{ slug: 'zerone', name: 'Zerone' }], ideas: [{ n: 1, site: 'zerone', title: 'A' }] }), /Editor says: judul #1/);
console.log('check-aiplan ok');
