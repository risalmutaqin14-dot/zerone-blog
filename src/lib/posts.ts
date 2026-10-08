import sanitizeHtml from 'sanitize-html';
import { slugify } from './slug.js';

export const PAGE_SIZE = 30;

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const cleanHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a', 'img'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }) },
  });

const isHttp = (u: string) => /^https?:\/\//i.test(u);

// Validasi + normalisasi payload post. Return { error } atau { data }.
export function parsePost(b: any): { error: string } | { data: Record<string, unknown> } {
  const title = String(b?.title ?? '').trim();
  if (!title) return { error: 'Judul wajib diisi' };
  if (title.length > 200) return { error: 'Judul maksimal 200 karakter' };

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

  const tags = [...new Set((Array.isArray(b.tags) ? b.tags : []).map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10);

  return {
    data: {
      title,
      slug,
      excerpt: String(b.excerpt ?? '').trim().slice(0, 500),
      content: cleanHtml(String(b.content ?? '')),
      cover_url: cover || null,
      category_id: b.category_id || null,
      tags,
      status,
      published_at,
    },
  };
}

export const dbError = (e: { code?: string; message: string }) =>
  e.code === '23505' ? json({ error: 'Slug sudah dipakai' }, 409)
  : e.code === '23503' ? json({ error: 'Masih dipakai data lain' }, 409)
  : json({ error: e.message }, 500);
