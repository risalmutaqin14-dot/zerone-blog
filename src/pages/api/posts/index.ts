import type { APIRoute } from 'astro';
import { admin } from '../../../db/admin';
import { fail, guard, ok, preflight } from '../../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// GET /api/posts?page=1&limit=10&category=slug&author=slug&tag=foo&q=kata
// q: full-text search (kolom `search`, lihat supabase/schema.sql). Semua kata harus cocok, prefix match. Urut tetap terbaru dulu.
export const GET: APIRoute = async ({ request, url }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;

  const q = url.searchParams;
  const page = Math.max(1, Number(q.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(q.get('limit')) || 10));
  const from = (page - 1) * limit;

  // !inner hanya saat filter kategori, supaya post tanpa kategori tetap muncul di listing biasa.
  const join = q.get('category') ? 'categories!inner' : 'categories';
  const authorJoin = q.get('author') ? 'authors!inner' : 'authors';
  let query = admin
    .from('posts')
    .select(`id,title,slug,excerpt,cover_url,cover_alt,cover_width,cover_height,meta_title,meta_description,noindex,tags,published_at,updated_at,author:${authorJoin}(name,slug),category:${join}(name,slug)`, { count: 'exact' })
    .eq('website_id', site.id)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(from, from + limit - 1);

  if (q.get('category')) query = query.eq('category.slug', q.get('category')!);
  if (q.get('author')) query = query.eq('author.slug', q.get('author')!);
  const term = (q.get('q') ?? '').trim().slice(0, 100);
  if (term) {
    // Hanya huruf/angka lolos ke tsquery, jadi tidak ada operator yang bisa disisipkan.
    const words = term.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8);
    if (words) query = query.textSearch('search', words.map((w) => `${w}:*`).join(' & '), { config: 'simple' });
  }
  if (q.get('tag')) query = query.contains('tags', [q.get('tag')!.toLowerCase()]);

  const { data, count, error } = await query;
  if (error) return fail(error.message, 500, request);
  return ok({ data, page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) }, request);
};
