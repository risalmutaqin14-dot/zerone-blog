// Import post dari file ekspor WordPress (WXR .xml) ke tabel posts Supabase.
//
// Pakai:
//   node scripts/import-wordpress.mjs <file.xml> --website=edunav --dry-run
//   node --env-file=.env scripts/import-wordpress.mjs <file.xml> --website=edunav [opsi]
//
// Opsi:
//   --website=<slug>      wajib. Slug di tabel websites (edunav / latihan / zerone).
//   --dry-run             tidak menulis apa pun. Membuat pratinjau HTML di scripts/wp-import-preview/.
//   --status=draft        paksa semua post jadi draft (aman untuk uji coba). Default: ikut status WordPress.
//   --author=<slug>       semua post diberi author ini (slug di tabel authors). Default: cocokkan nama, kalau tidak ada = kosong.
//   --upload-images       unduh gambar wp-content/uploads, unggah ke bucket blog-images, ganti URL-nya.
//   --skip=<id,id,...>    lewati post (ID post WordPress atau slug).
//   --update              post dengan slug yang sudah ada di website itu ditimpa. Default: dilewati.
//   --link-base=<url>     ganti link antar-artikel lama (https://situs-wp/2026/01/09/<slug>/) jadi <url><slug>.
//
// Aman dijalankan ulang: post yang slug-nya sudah ada dilewati (kecuali --update), gambar ditulis dengan path tetap.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import { slugify } from '../src/lib/slug.js';

// ---------- argumen ----------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
if (!file || !opt.website) {
  console.error('Pakai: node --env-file=.env scripts/import-wordpress.mjs <file.xml> --website=<slug> [--dry-run] [--status=draft] [--author=<slug>] [--upload-images] [--skip=id,id] [--update] [--link-base=<url>]');
  process.exit(1);
}
const DRY = !!opt['dry-run'];
const skip = new Set(String(opt.skip ?? '').split(',').map((s) => s.trim()).filter(Boolean));

// ---------- parser WXR ----------
const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
// CDATA asli: isi <![CDATA[...]]> tidak di-unescape (WordPress menaruh HTML mentah di dalamnya).
const cdataOrText = (s = '') => {
  const parts = [...s.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)];
  return parts.length ? parts.map((m) => m[1]).join('') : decode(s);
};
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const field = (xml, tag) => {
  const m = xml.match(new RegExp(`<${esc(tag)}>([\\s\\S]*?)</${esc(tag)}>`));
  return m ? cdataOrText(m[1]).trim() : '';
};

function parseWxr(xml) {
  const channel = xml.slice(0, xml.indexOf('<item>'));
  const baseUrl = field(channel, 'wp:base_site_url').replace(/\/$/, '');
  const authors = new Map(
    [...channel.matchAll(/<wp:author>([\s\S]*?)<\/wp:author>/g)].map((m) => [field(m[1], 'wp:author_login'), field(m[1], 'wp:author_display_name')]),
  );
  const terms = new Map(
    [...channel.matchAll(/<wp:category>([\s\S]*?)<\/wp:category>/g)].map((m) => [field(m[1], 'wp:term_id'), field(m[1], 'wp:category_nicename')]),
  );

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const raw = m[1];
    const content = field(raw, 'content:encoded');
    const excerpt = field(raw, 'excerpt:encoded');
    const rest = raw.replace(/<content:encoded>[\s\S]*?<\/content:encoded>/, '').replace(/<excerpt:encoded>[\s\S]*?<\/excerpt:encoded>/, '');
    const meta = Object.fromEntries(
      [...rest.matchAll(/<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g)].map((p) => [field(p[1], 'wp:meta_key'), field(p[1], 'wp:meta_value')]),
    );
    const cats = [...rest.matchAll(/<category domain="([^"]+)" nicename="([^"]+)">([\s\S]*?)<\/category>/g)].map((c) => ({
      domain: c[1],
      slug: decodeURIComponent(c[2]),
      name: cdataOrText(c[3]).trim(),
    }));
    return {
      id: field(rest, 'wp:post_id'),
      type: field(rest, 'wp:post_type'),
      status: field(rest, 'wp:status'),
      title: decode(field(rest, 'title')),
      slug: field(rest, 'wp:post_name'),
      link: field(rest, 'link'),
      creator: field(rest, 'dc:creator'),
      date: field(rest, 'wp:post_date_gmt'),
      modified: field(rest, 'wp:post_modified_gmt'),
      attachmentUrl: field(rest, 'wp:attachment_url'),
      content,
      excerpt,
      meta,
      cats,
    };
  });
  return { baseUrl, authors, terms, items };
}

const gmt = (s) => (s && !s.startsWith('0000') ? new Date(s.replace(' ', 'T') + 'Z').toISOString() : null);

// ---------- pembersihan HTML ----------
// Konfigurasi sama dengan cleanHtml() di src/lib/posts.ts (tidak bisa diimpor: modul itu butuh astro:env).
// Kalau daftar tag di sana berubah, samakan di sini.
const ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'table', 'img']);

const hostsOf = (origins = '') => origins.split(',').flatMap((o) => { try { return [new URL(o.trim()).host]; } catch { return []; } });
const isInternal = (href = '', hosts) => {
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return true;
  try { return hosts.includes(new URL(href).host); } catch { return false; }
};
const fixLink = (hosts) => (tagName, { rel: _rel, ...attribs }) => {
  const rel = isInternal(attribs.href, hosts) ? (attribs.target === '_blank' ? 'noopener' : '') : 'noopener noreferrer nofollow';
  return { tagName, attribs: rel ? { ...attribs, rel } : attribs };
};
const fixImg = (tagName, { width, height, ...rest }) => {
  const num = (v) => !!v && /^\d{1,5}$/.test(v);
  return { tagName, attribs: num(width) && num(height) ? { ...rest, width, height } : rest };
};
const fixSpan = (tagName, { colspan, rowspan, ...rest }) => {
  const ok = (v) => !!v && /^(?:[1-9]|1\d|20)$/.test(v);
  return { tagName, attribs: { ...rest, ...(ok(colspan) ? { colspan } : {}), ...(ok(rowspan) ? { rowspan } : {}) } };
};
const addHeadingIds = (html) => {
  const seen = new Map();
  return html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (_m, lvl, attrs, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, ' ');
    const base = slugify(text) || 'bagian';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `<h${lvl}${attrs} id="${n ? `${base}-${n}` : base}">${inner}</h${lvl}>`;
  });
};

// Tahap 1: buang sisa Elementor/WordPress yang bukan isi artikel.
function stripWordPress(html, baseUrl) {
  const home = esc(baseUrl);
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|noscript|svg|button|iframe|form|template)\b[\s\S]*?<\/\1>/gi, '')
    // Grid "Artikel Terbaru" (Essential Addons) di akhir artikel.
    .replace(/(?:Blog\s*)?<h2[^>]*>\s*Artikel Terbaru\s*<\/h2>/gi, '')
    .replace(/<article\b[^>]*data-id=[\s\S]*?<\/article>/gi, '')
    // Subjudul + breadcrumb Elementor: <h2>..</h2> <a href="home">Home</a> /
    .replace(new RegExp(`^\\s*<h2[^>]*>[^<]*<\\/h2>\\s*<a href="${home}/?">Home<\\/a>\\s*\\/`, 'i'), '')
    .replace(new RegExp(`<a href="${home}/?">Home<\\/a>\\s*\\/`, 'gi'), '')
    // Judul artikel sudah ada di kolom title.
    .replace(/<h1\b[\s\S]*?<\/h1>/gi, '')
    // Tombol share (href="#").
    .replace(/<a\b[^>]*href="#"[^>]*>[\s\S]*?<\/a>/gi, '')
    // FAQ <details>: pertanyaan jadi h3, jawaban jadi paragraf.
    .replace(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi, (_m, q, a) =>
      `<h3>${q.trim()}</h3>${/<(p|ul|ol|table)\b/i.test(a) ? a : `<p>${a.trim()}</p>`}`)
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, '<p><em>$1</em></p>')
    .replace(/<cite\b[^>]*>([\s\S]*?)<\/cite>/gi, '<p><em>— $1</em></p>')
    .replace(/&nbsp;/g, ' ');
}

// Tahap 3: teks lepas di level atas dibungkus <p> (paragraf dipisah baris kosong, seperti wpautop).
function wrapLoose(html) {
  const out = [];
  let buf = '';
  const flush = () => {
    for (const para of buf.split(/\n\s*\n|(?:<br\s*\/?>\s*){2,}/)) {
      const t = para.replace(/^(\s|<br\s*\/?>)+|(\s|<br\s*\/?>)+$/g, '').replace(/\s+/g, ' ');
      if (t.replace(/<[^>]*>/g, '').trim()) out.push(`<p>${t}</p>`);
    }
    buf = '';
  };
  const re = /<(\/?)([a-z0-9]+)\b[^>]*>/gi;
  let i = 0;
  let depth = 0;
  let open = '';
  let start = 0;
  for (let m; (m = re.exec(html)); ) {
    const [tag, close, nameRaw] = m;
    const name = nameRaw.toLowerCase();
    if (depth === 0) {
      if (!close && BLOCK.has(name)) {
        buf += html.slice(i, m.index);
        flush();
        if (name === 'img' || name === 'hr') { out.push(tag); i = re.lastIndex; continue; }
        depth = 1; open = name; start = m.index;
        continue;
      }
      continue;
    }
    if (name === open) depth += close ? -1 : 1;
    if (depth === 0) {
      out.push(html.slice(start, re.lastIndex));
      i = re.lastIndex;
    }
  }
  buf += html.slice(i);
  flush();
  return out.filter((b) => !/^<p>\s*<\/p>$/.test(b));
}

// Tahap 4: buang "kepala" artikel bawaan template Elementor yang sudah diwakili kolom lain:
// toast share, label hero ("Case Study · OSN 2026"), baris meta ber-emoji, subjudul yang mengulang judul,
// dan gambar hero yang sama dengan cover (situs sudah menampilkan cover di atas artikel).
const baseName = (u = '') => u.split('/').pop().split('?')[0].replace(/-\d+x\d+(?=\.\w+$)/, '').replace(/^\[blog-images\]/, '');
function trimLead(blocks, title, coverUrl) {
  const norm = (s) => textOf(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = norm(title);
  const out = blocks.filter((b) => !/^<p>\s*Tautan disalin!?\s*<\/p>$/i.test(b));
  for (let n = 0; n < 4 && out.length; n++) {
    const b = out[0];
    const text = textOf(b);
    const isLabel = /^<p>/.test(b) && text.length <= 50 && / · /.test(text);
    const isMeta = /^<p>/.test(b) && text.length <= 160 && /^\p{Extended_Pictographic}/u.test(text);
    const isTitleRepeat = /^<h[1-4]/.test(b) && norm(b) && t.includes(norm(b));
    const isHero = /^<img/.test(b) && coverUrl && baseName(b.match(/src="([^"]+)"/)?.[1]) === baseName(coverUrl);
    if (!(isLabel || isMeta || isTitleRepeat)) break;
    out.shift();
  }
  // Gambar hero = cover, biasanya di 3 blok pertama. Caption-nya ikut dibuang.
  const hero = out.slice(0, 3).findIndex((b) => /^<img/.test(b) && coverUrl && baseName(b.match(/src="([^"]+)"/)?.[1]) === baseName(coverUrl));
  if (hero >= 0) out.splice(hero, /^<p><em>[\s\S]*<\/em><\/p>$/.test(out[hero + 1] ?? '') ? 2 : 1);
  return out;
}

export function cleanContent(html, baseUrl, hosts, title = '', coverUrl = '') {
  const stage1 = stripWordPress(html, baseUrl);
  const stage2 = sanitizeHtml(stage1, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      b: 'strong', i: 'em', h5: 'h4', h6: 'h4',
      a: fixLink(hosts), img: fixImg, th: fixSpan, td: fixSpan,
    },
    // Link/paragraf kosong (sisa Elementor) dibuang; yang berisi gambar dipertahankan.
    exclusiveFilter: (f) => ['a', 'p'].includes(f.tag) && !f.text.trim() && !f.mediaChildren?.length,
  });
  return addHeadingIds(trimLead(wrapLoose(stage2), title, coverUrl).join('\n'));
}

const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const textOf = (html) =>
  html
    .replace(/<\/?(?:strong|em|u|s|mark|code|a|b|i|span)\b[^>]*>/gi, '') // tag inline: tanpa spasi tambahan
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
const cut = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1).replace(/[\s,.;:–-]+$/, '') + '…');
const firstParagraph = (html) => {
  for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    if (/^\s*<em>[\s\S]*<\/em>\s*$/.test(m[1])) continue; // caption gambar
    const t = textOf(m[1]);
    if (t.length > 60) return t;
  }
  return textOf(html);
};
// Ukuran asli dari _wp_attachment_metadata (array PHP ter-serialize).
const dims = (serialized = '') => {
  const w = serialized.match(/s:5:"width";i:(\d+);/)?.[1];
  const h = serialized.match(/s:6:"height";i:(\d+);/)?.[1];
  return w && h ? { width: +w, height: +h } : { width: null, height: null };
};

// ---------- main ----------
const here = dirname(fileURLToPath(import.meta.url));
const xml = await readFile(file, 'utf8');
const { baseUrl, authors: wpAuthors, terms, items } = parseWxr(xml);
const attachments = new Map(items.filter((i) => i.type === 'attachment').map((a) => [a.id, a]));
const wpPosts = items.filter((i) => i.type === 'post' && !['trash', 'auto-draft'].includes(i.status) && !skip.has(i.id) && !skip.has(i.slug));
console.log(`File: ${baseUrl} — ${wpPosts.length} post, ${attachments.size} attachment${skip.size ? `, dilewati: ${[...skip].join(', ')}` : ''}`);

let db = null;
let site = { id: '(dry-run)', allowed_origin: '' };
if (!DRY) {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (pakai --env-file=.env).');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from('websites').select('id,name,allowed_origin').eq('slug', opt.website).maybeSingle();
  if (error) throw error;
  if (!data) {
    console.error(`Website "${opt.website}" tidak ada di tabel websites.`);
    process.exit(1);
  }
  site = data;
  console.log(`Target: website ${data.name} (${opt.website})`);
}
const hosts = hostsOf(site.allowed_origin);

// Link antar-artikel lama -> URL baru.
const importedSlugs = new Set(wpPosts.map((p) => slugify(p.slug || p.title)));
const rewriteLinks = (html) => {
  if (!opt['link-base']) return html;
  const re = new RegExp(`${esc(baseUrl).replace('www\\.', '(?:www\\.)?')}/(?:\\d{4}/\\d{2}/\\d{2}/)?([a-z0-9-]+)/?(?=["#?])`, 'g');
  return html.replace(re, (m, s) => (importedSlugs.has(s) ? `${String(opt['link-base']).replace(/\/?$/, '/')}${s}` : m));
};

// ---------- gambar ----------
const imageCache = new Map();
async function migrateImage(src) {
  if (!opt['upload-images'] || !src.includes('/wp-content/uploads/')) return src;
  if (imageCache.has(src)) return imageCache.get(src);
  const path = 'wp-import/' + src.split('/wp-content/uploads/')[1].split('?')[0];
  if (DRY) { imageCache.set(src, `[blog-images]/${path}`); return `[blog-images]/${path}`; }
  const res = await fetch(src, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) { console.warn(`  ! gagal unduh ${src} (${res.status}), URL lama dipertahankan`); imageCache.set(src, src); return src; }
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const { error } = await db.storage.from('blog-images').upload(path, buf, { contentType: type, upsert: true });
  if (error) { console.warn(`  ! gagal unggah ${path}: ${error.message}`); imageCache.set(src, src); return src; }
  const url = db.storage.from('blog-images').getPublicUrl(path).data.publicUrl;
  imageCache.set(src, url);
  return url;
}
async function migrateImagesIn(html) {
  const srcs = [...new Set([...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]))];
  for (const s of srcs) html = html.split(`src="${s}"`).join(`src="${await migrateImage(s)}"`);
  return html;
}

// ---------- kategori & author ----------
const catCache = new Map();
async function categoryId(cat) {
  if (!cat) return null;
  if (catCache.has(cat.slug)) return catCache.get(cat.slug);
  let id = `(kategori: ${cat.slug})`;
  if (!DRY) {
    const { data, error } = await db.from('categories').select('id').eq('slug', cat.slug).maybeSingle();
    if (error) throw error;
    if (data) id = data.id;
    else {
      const ins = await db.from('categories').insert({ name: cat.name, slug: cat.slug }).select('id').single();
      if (ins.error) throw ins.error;
      id = ins.data.id;
      console.log(`  + kategori baru: ${cat.name} (${cat.slug})`);
    }
  }
  catCache.set(cat.slug, id);
  return id;
}
const authorCache = new Map();
async function authorId(login) {
  const key = opt.author ? `slug:${opt.author}` : `name:${login}`;
  if (authorCache.has(key)) return authorCache.get(key);
  let id = null;
  if (!DRY) {
    const q = opt.author
      ? db.from('authors').select('id').eq('slug', opt.author)
      : db.from('authors').select('id').ilike('name', wpAuthors.get(login) || login);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) throw error;
    if (!data && opt.author) { console.error(`Author dengan slug "${opt.author}" tidak ada.`); process.exit(1); }
    id = data?.id ?? null;
    if (!id) console.warn(`  ! author WordPress "${login}" tidak cocok dengan author mana pun: post dibiarkan tanpa author`);
  }
  authorCache.set(key, id);
  return id;
}

// ---------- slug yang sudah ada ----------
let existing = new Map();
if (!DRY) {
  const { data, error } = await db.from('posts').select('id,slug').eq('website_id', site.id).in('slug', [...importedSlugs]);
  if (error) throw error;
  existing = new Map(data.map((p) => [p.slug, p.id]));
}

// ---------- proses ----------
const report = [];
const preview = [];
for (const p of wpPosts) {
  const slug = slugify(p.slug || p.title);
  const cats = p.cats.filter((c) => c.domain === 'category');
  const primarySlug = terms.get(p.meta._yoast_wpseo_primary_category) || terms.get(p.meta.rank_math_primary_category);
  const cat = cats.find((c) => c.slug === primarySlug) ?? cats[0];
  const tags = [...new Set(p.cats.filter((c) => c.domain === 'post_tag').map((c) => c.name.trim().toLowerCase()).filter(Boolean))].slice(0, 10);

  const thumb = attachments.get(p.meta._thumbnail_id);
  let content = rewriteLinks(cleanContent(p.content, baseUrl, hosts, p.title, thumb?.attachmentUrl));
  content = await migrateImagesIn(content);

  const { width, height } = dims(thumb?.meta._wp_attachment_metadata);
  const cover = thumb?.attachmentUrl ? await migrateImage(thumb.attachmentUrl) : null;

  const yoastTitle = p.meta._yoast_wpseo_title || p.meta.rank_math_title || '';
  const metaDesc = p.meta._yoast_wpseo_metadesc || p.meta.rank_math_description || '';
  const excerpt = cut(textOf(p.excerpt) || firstParagraph(content), 200);
  const status = opt.status === 'draft' ? 'draft' : p.status === 'publish' ? 'published' : 'draft';

  const row = {
    website_id: site.id,
    title: p.title.slice(0, 200),
    slug,
    excerpt,
    content,
    cover_url: cover,
    cover_alt: (thumb?.meta._wp_attachment_image_alt || '').slice(0, 200),
    cover_width: cover && width ? width : null,
    cover_height: cover && height ? height : null,
    meta_title: yoastTitle.includes('%%') ? '' : yoastTitle.slice(0, 70),
    meta_description: metaDesc.includes('%%') ? '' : metaDesc.slice(0, 160),
    category_id: await categoryId(cat),
    author_id: await authorId(p.creator),
    tags,
    status,
    published_at: status === 'published' ? gmt(p.date) : null,
    created_at: gmt(p.date) ?? new Date().toISOString(),
    updated_at: gmt(p.modified) ?? gmt(p.date) ?? new Date().toISOString(),
    // null = cron /api/cron/publish mengirim webhook revalidate ke situs, sama seperti post dari admin.
    announced_at: null,
  };

  const imgs = (content.match(/<img/g) || []).length;
  const words = textOf(content).split(' ').length;
  const line = { wp: p.id, slug, status, kategori: cat?.slug ?? '-', tags: tags.length, gambar: imgs, kata: words };

  if (DRY) {
    line.aksi = 'dry-run';
    preview.push({ p, row, cat });
  } else if (existing.has(slug) && !opt.update) {
    line.aksi = 'dilewati (slug sudah ada)';
  } else if (existing.has(slug)) {
    const { created_at: _c, ...upd } = row;
    const { error } = await db.from('posts').update(upd).eq('id', existing.get(slug));
    line.aksi = error ? `GAGAL: ${error.message}` : 'diperbarui';
  } else {
    const { error } = await db.from('posts').insert(row);
    line.aksi = error ? `GAGAL: ${error.message}` : 'ditambahkan';
  }
  report.push(line);
}
console.table(report);

if (DRY) {
  const dir = join(here, 'wp-import-preview');
  await mkdir(dir, { recursive: true });
  const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pratinjau import WordPress</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;color:#1d2433}nav a{display:block}article{border-top:3px solid #1a6fcc;margin-top:48px;padding-top:16px}
.meta{font-size:13px;background:#f3f6fa;padding:10px 12px;border-radius:6px}.meta b{display:inline-block;min-width:130px}img{max-width:100%;height:auto;outline:2px dashed #9bb7d9}
table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:4px 8px}blockquote{border-left:4px solid #cbd;margin:0;padding-left:16px;color:#445}</style>
<h1>Pratinjau import: ${preview.length} post</h1><p>Hasil yang akan masuk ke kolom <code>content</code>. Garis putus-putus = gambar.</p>
<nav>${preview.map(({ row }, i) => `<a href="#p${i}">${h(row.title)}</a>`).join('')}</nav>
${preview.map(({ p, row, cat }, i) => `<article id="p${i}"><h1>${h(row.title)}</h1><div class="meta">
<b>WP ID</b>${p.id}<br><b>Slug</b>${h(row.slug)}<br><b>Status</b>${row.status} · ${row.published_at ?? '-'}<br><b>Kategori</b>${h(cat?.name ?? '-')}<br>
<b>Tags</b>${h(row.tags.join(', ') || '-')}<br><b>Author WP</b>${h(p.creator)}<br><b>Cover</b>${h(row.cover_url ?? '-')} ${row.cover_width ? `(${row.cover_width}×${row.cover_height})` : ''}<br>
<b>Excerpt</b>${h(row.excerpt)}<br><b>Meta title</b>${h(row.meta_title || '-')}<br><b>Meta desc</b>${h(row.meta_description || '-')}</div>
${row.cover_url && !row.cover_url.startsWith('[') ? `<img src="${h(row.cover_url)}" alt="">` : ''}${row.content}</article>`).join('\n')}`;
  await writeFile(join(dir, 'index.html'), page);
  console.log(`\nDry-run selesai. Tidak ada yang ditulis ke database.\nPratinjau: ${join(dir, 'index.html')}`);
} else {
  const ok = report.filter((r) => r.aksi === 'ditambahkan' || r.aksi === 'diperbarui').length;
  console.log(`\nSelesai: ${ok} post ditulis.${opt['upload-images'] ? ` ${[...imageCache.values()].filter((u) => !u.includes('/wp-content/')).length} gambar dipindah ke blog-images.` : ''}`);
}
