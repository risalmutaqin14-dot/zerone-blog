// Backup darurat seluruh artikel zerone.id/blog selagi halamannya masih bisa dibuka.
// Menyimpan: HTML mentah tiap artikel, data RSC Next.js (sering berisi data post asli dari WordPress),
// dan semua gambar (dicoba lewat cache gambar Next.js, URL asli, lalu Wayback Machine).
//
// Pakai (di Codespaces, dari folder proyek):
//   node scripts/backup-zerone-blog.mjs
// Hasil: folder zerone-backup/ (sudah aman dari git kalau dimasukkan ke .gitignore).
// Aman dijalankan ulang: file yang sudah ada dilewati.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) ?? '--base=https://zerone.id').slice(7).replace(/\/$/, '');
const OUT = 'zerone-backup';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function get(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      return res;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(1500);
    }
  }
}
const save = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };

// 1. Kumpulkan URL artikel dari semua halaman daftar blog.
const slugs = new Set();
for (let page = 1; page <= 50; page++) {
  const url = page === 1 ? `${BASE}/blog` : `${BASE}/blog?page=${page}`;
  const res = await get(url);
  if (!res.ok) { console.log(`Halaman ${page}: HTTP ${res.status}, berhenti.`); break; }
  const html = await res.text();
  await save(join(OUT, 'listing', `page-${page}.html`), html);
  const found = [...html.matchAll(/href="(?:https?:\/\/[^/"]*zerone\.id)?\/blog\/([a-z0-9][a-z0-9-]*)\/?"/gi)].map((m) => m[1].toLowerCase());
  const fresh = found.filter((s) => !slugs.has(s));
  fresh.forEach((s) => slugs.add(s));
  console.log(`Halaman ${page}: ${found.length} link artikel, ${fresh.length} baru`);
  if (!fresh.length) break;
  await sleep(500);
}
console.log(`\nTotal artikel: ${slugs.size}\n`);

// 2. Simpan tiap artikel: HTML + payload RSC.
const images = new Set();
const manifest = [];
const collectImages = (text) => {
  const t = text.replace(/\\u0026/g, '&').replace(/&amp;/g, '&').replace(/\\\//g, '/');
  for (const m of t.matchAll(/https?:\/\/blog\.zerone\.id\/wp-content\/uploads\/[^"'\s)\\<>?]+/g)) images.add(m[0]);
  for (const m of t.matchAll(/\/_next\/image\?url=([^&"'\s\\]+)/g)) {
    const u = decodeURIComponent(m[1]);
    if (u.includes('/wp-content/uploads/')) images.add(u.split('?')[0]);
  }
};
for (const slug of slugs) {
  const url = `${BASE}/blog/${slug}`;
  const entry = { slug, url, html: false, rsc: false };
  try {
    const res = await get(url);
    entry.status = res.status;
    if (res.ok) {
      const html = await res.text();
      await save(join(OUT, 'articles', `${slug}.html`), html);
      collectImages(html);
      entry.html = true;
    }
    const rsc = await get(url, { RSC: '1' });
    if (rsc.ok && /text\/x-component/.test(rsc.headers.get('content-type') ?? '')) {
      const body = await rsc.text();
      await save(join(OUT, 'articles', `${slug}.rsc.txt`), body);
      collectImages(body);
      entry.rsc = true;
    }
  } catch (e) {
    entry.error = String(e.message ?? e);
  }
  manifest.push(entry);
  console.log(`${entry.html ? '✓' : '✗'} ${slug}${entry.rsc ? ' (+data RSC)' : ''}${entry.error ? ' — ' + entry.error : ''}`);
  await sleep(400);
}

// 3. Gambar: cache Next.js -> URL asli -> Wayback Machine.
console.log(`\nGambar ditemukan: ${images.size}`);
const imgReport = [];
const isImage = (res) => res?.ok && /^image\//.test(res.headers.get('content-type') ?? '');
for (const src of images) {
  const rel = src.split('/wp-content/uploads/')[1];
  const path = join(OUT, 'images', rel);
  if (await exists(path)) { imgReport.push({ src, via: 'sudah ada' }); continue; }
  const tries = [
    ['next-cache', `${BASE}/_next/image?url=${encodeURIComponent(src)}&w=3840&q=75`],
    ['asli', src],
    ['wayback', `https://web.archive.org/web/2026id_/${src}`],
  ];
  let via = 'GAGAL';
  for (const [name, u] of tries) {
    try {
      // Accept tanpa webp/avif: Next.js mengembalikan format asli (png/jpg).
      const res = await get(u, { Accept: 'image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5' });
      if (isImage(res)) {
        await save(path, Buffer.from(await res.arrayBuffer()));
        via = name;
        break;
      }
    } catch { /* coba sumber berikutnya */ }
  }
  imgReport.push({ src, via });
  console.log(`${via === 'GAGAL' ? '✗' : '✓'} [${via}] ${rel}`);
  await sleep(200);
}

await save(join(OUT, 'manifest.json'), JSON.stringify({ base: BASE, savedAt: new Date().toISOString(), articles: manifest, images: imgReport }, null, 2));
const okA = manifest.filter((a) => a.html).length;
const okI = imgReport.filter((i) => i.via !== 'GAGAL').length;
console.log(`\nSelesai. Artikel: ${okA}/${manifest.length}. Gambar: ${okI}/${imgReport.length}. Tersimpan di folder ${OUT}/`);
console.log(`Bungkus untuk dikirim: zip -r zerone-backup.zip ${OUT}`);
