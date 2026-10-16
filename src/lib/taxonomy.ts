import { slugify } from './slug.js';

type Parsed = { error: string } | { data: Record<string, unknown> };

export const isHttp = (u: string) => /^https?:\/\//i.test(u);
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function parseCategory(b: any): Parsed {
  const name = str(b?.name, 60);
  const slug = slugify(b?.slug || name);
  if (!name || !slug) return { error: 'Nama wajib diisi' };
  return { data: { name, slug, description: str(b?.description, 300) } };
}

// links: array URL atau string satu-URL-per-baris.
export function parseAuthor(b: any): Parsed {
  const name = str(b?.name, 80);
  const slug = slugify(b?.slug || name);
  if (!name || !slug) return { error: 'Nama wajib diisi' };

  const avatar = str(b?.avatar_url, 500);
  if (avatar && !isHttp(avatar)) return { error: 'URL avatar tidak valid' };

  const raw = Array.isArray(b?.links) ? b.links : String(b?.links ?? '').split('\n');
  const links = [...new Set<string>(raw.map((l: unknown) => str(l, 300)).filter(Boolean))].slice(0, 10);
  if (links.some((l) => !isHttp(l))) return { error: 'Link sosial harus diawali http(s)://' };

  return { data: { name, slug, bio: str(b?.bio, 500), avatar_url: avatar || null, links } };
}
