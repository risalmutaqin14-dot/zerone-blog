import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { PAGE_SIZE, UUID, dbError, json, parsePost } from '../../../../lib/posts';
import { revalidatePost } from '../../../../lib/revalidate';

// GET /api/admin/posts?page=1&limit=30&q=judul&status=draft|published|scheduled&category=<uuid>&website=<uuid>
export const GET: APIRoute = async ({ url }) => {
  const sp = url.searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || PAGE_SIZE));
  const from = (page - 1) * limit;
  const now = new Date().toISOString();
  const status = sp.get('status');
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const category = sp.get('category') ?? '';
  const website = sp.get('website') ?? '';

  let query = admin
    .from('posts')
    .select('id,title,slug,excerpt,cover_url,tags,status,published_at,created_at,updated_at,category:categories(name,slug),author:authors(name,slug),website:websites(name,slug)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, from + limit - 1);
  if (q) query = query.ilike('title', `%${q.replace(/[%_\\,()*]/g, ' ')}%`);
  if (status === 'draft') query = query.eq('status', 'draft');
  if (status === 'published') query = query.eq('status', 'published').lte('published_at', now);
  if (status === 'scheduled') query = query.eq('status', 'published').gt('published_at', now);
  if (UUID.test(category)) query = query.eq('category_id', category);
  if (UUID.test(website)) query = query.eq('website_id', website);

  const { data, count, error } = await query;
  if (error) return dbError(error);
  return json({ data, page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) });
};

export const POST: APIRoute = async ({ request }) => {
  const parsed = await parsePost(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin.from('posts').insert(parsed.data).select('id').single();
  if (error) return dbError(error);
  await revalidatePost(data.id, parsed.data.slug as string);
  return json(data, 201);
};
