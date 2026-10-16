import sanitizeHtml from 'sanitize-html';
import { SITE_URL } from 'astro:env/server';
import { slugify } from './slug.js';
import { isHttp } from './taxonomy';

export const PAGE_SIZE = 30;
export const UUID = /^[0-9a-f-]{36}$/i;

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const siteHost = (() => {
  try { return new URL(SITE_URL).host; } catch { return ''; }
})();

const isInternal = (href = '') => {
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return true;
  try { return !!siteHost && new URL(href).host === siteHost; } catch { return false; }
};

// Link internal: tanpa nofollow. Eksternal: nofollow. rel dari editor selalu dibuang.
const fixLink = (tagName: string, { rel: _rel, ...attribs }: sanitizeHtml.Attributes) => {
  const rel = isInternal(attribs.href) ? (attribs.target === '_blank' ? 'noopener' : '') : 'noopener noreferrer nofollow';
  return { tagName, attribs: rel ? { ...attribs, rel } : attribs };
};

// width/height hanya lolos kalau keduanya angka (satu saja = gambar bisa gepeng).
const fixImg = (tagName: string, { width, height, ...rest }: sanitizeHtml.Attributes) => {
  const num = (v?: string) => !!v && /^\d{1,5}$/.test(v);
  return { tagName, attribs: num(width) && num(height) ? { ...rest, width, height } : rest };
};

// colspan/rowspan hanya angka 1-20 (cegah nilai aneh yang merusak layout tabel).
const fixSpan = (tagName: string, { colspan, rowspan, ...rest }: sanitizeHtml.Attributes) => {
  const ok = (v?: string) => !!v && /^(?:[1-9]|1\d|20)$/.test(v);
  return { tagName, attribs: { ...rest, ...(ok(colspan) ? { colspan } : {}), ...(ok(rowspan) ? { rowspan } : {}) } };
};

// Editor tidak menghasilkan id, jadi id heading dibuat di sini (untuk daftar isi & anchor di Next.js).
const addHeadingIds = (html: string) => {
  const seen = new Map<string, number>();
  return html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (_m: string, lvl: string, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, ' ');
    const base = slugify(text) || 'bagian';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `<h${lvl}${attrs} id="${n ? `${base}-${n}` : base}">${inner}</h${lvl}>`;
  });
};

export const cleanHtml = (html: string) =>
  addHeadingIds(
    sanitizeHtml(html, {
      allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
      allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: { a: fixLink, img: fixImg, th: fixSpan, td: fixSpan },
    }),
  );

const dim = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : null;
};

// Validasi + normalisasi payload post. Return { error } atau { data }.
export function parsePost(b: any): { error: string } | { data: Record<string, unknown> } {
  const title = String(b?.title ?? '').trim();
  if (!title) return { error: 'Judul wajib diisi' };
  if (title.length > 200) return { error: 'Judul maksimal 200 karakter' };
  if (!UUID.test(String(b.website_id ?? ''))) return { error: 'Website wajib dipilih' };

  const slug = slugify(b.slug || title);
  if (!slug) return { error: 'Slug tidak valid' };

  const status = b.status === 'published' ? 'published' : 'draft';
  let published_at: string | null = null;
  if (status === 'published') {
    const d = b.published_at ? new Date(b.published_at) : new Date();
    if (isNaN(+d)) return { error: 'Tanggal publish tidak valid' };
    published_at = d.toISOString();
  }

  const cover = String(b.cover_url ?? '').trim();
  if (cover && !isHttp(cover)) return { error: 'URL cover tidak valid' };
  const w = dim(b.cover_width);
  const h = dim(b.cover_height);

  const canonical = String(b.canonical_url ?? '').trim().slice(0, 500);
  if (canonical && !isHttp(canonical)) return { error: 'Canonical URL tidak valid' };
  const og = String(b.og_image ?? '').trim().slice(0, 500);
  if (og && !isHttp(og)) return { error: 'URL OG image tidak valid' };

  const tags = [...new Set((Array.isArray(b.tags) ? b.tags : []).map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10);

  return {
    data: {
      title,
      slug,
      excerpt: String(b.excerpt ?? '').trim().slice(0, 500),
      content: cleanHtml(String(b.content ?? '')),
      cover_url: cover || null,
      cover_alt: String(b.cover_alt ?? '').trim().slice(0, 200),
      cover_width: cover && w && h ? w : null,
      cover_height: cover && w && h ? h : null,
      meta_title: String(b.meta_title ?? '').trim().slice(0, 70),
      meta_description: String(b.meta_description ?? '').trim().slice(0, 160),
      canonical_url: canonical || null,
      og_image: og || null,
      noindex: b.noindex === true,
      category_id: b.category_id || null,
      author_id: b.author_id || null,
      website_id: b.website_id,
      tags,
      status,
      published_at,
      // Selalu direset: diisi lagi oleh revalidatePost() hanya kalau webhook sukses, kalau gagal cron mengulang.
      announced_at: null,
    },
  };
}

export const dbError = (e: { code?: string; message: string }) =>
  e.code === '23505' ? json({ error: 'Slug sudah dipakai' }, 409)
  : e.code === '23503' ? json({ error: 'Masih dipakai data lain' }, 409)
  : json({ error: e.message }, 500);
