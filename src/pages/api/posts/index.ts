import type { APIRoute } from 'astro';
import { admin } from '../../../db/admin';
import { fail, guard, ok, preflight } from '../../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// GET /api/posts?page=1&limit=10&category=slug&tag=foo
export const GET: APIRoute = async ({ request, url }) => {
  const denied = guard(request);
  if (denied) return denied;

  const q = url.searchParams;
  const page = Math.max(1, Number(q.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(q.get('limit')) || 10));
  const from = (page - 1) * limit;

  // !inner hanya saat filter kategori, supaya post tanpa kategori tetap muncul di listing biasa.
  const join = q.get('category') ? 'categories!inner' : 'categories';
  let query = admin
    .from('posts')
    .select(`id,title,slug,excerpt,cover_url,tags,published_at,updated_at,category:${join}(name,slug)`, { count: 'exact' })
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(from, from + limit - 1);

  if (q.get('category')) query = query.eq('category.slug', q.get('category')!);
  if (q.get('tag')) query = query.contains('tags', [q.get('tag')!.toLowerCase()]);

  const { data, count, error } = await query;
  if (error) return fail(error.message, 500);
  return ok({ data, page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) });
};
