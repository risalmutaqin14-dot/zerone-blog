import type { APIRoute } from 'astro';
import { admin } from '../../db/admin';
import { fail, guard, ok, preflight } from '../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// Daftar tag + jumlah post terbit. Dihitung di sini karena tags adalah text[] (tidak ada tabel tag).
export const GET: APIRoute = async ({ request }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;

  const { data, error } = await admin
    .from('posts')
    .select('tags')
    .eq('website_id', site.id)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .range(0, 9999);
  if (error) return fail(error.message, 500, request);

  const counts = new Map<string, number>();
  for (const p of data ?? []) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts].map(([tag, posts]) => ({ tag, posts })).sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag));
  return ok(tags, request);
};
