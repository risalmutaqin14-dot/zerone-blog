import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json, parsePost } from '../../../../lib/posts';

export const GET: APIRoute = async ({ params }) => {
  const { data, error } = await admin
    .from('posts')
    .select('id,title,slug,excerpt,content,cover_url,tags,status,published_at,created_at,updated_at,category:categories(name)')
    .eq('id', params.id!)
    .maybeSingle();
  if (error) return dbError(error);
  return data ? json(data) : json({ error: 'Post tidak ditemukan' }, 404);
};

export const PUT: APIRoute = async ({ request, params }) => {
  const parsed = parsePost(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin.from('posts').update(parsed.data).eq('id', params.id!).select('id').maybeSingle();
  if (error) return dbError(error);
  return data ? json(data) : json({ error: 'Post tidak ditemukan' }, 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  const { error } = await admin.from('posts').delete().eq('id', params.id!);
  return error ? dbError(error) : json({ ok: true });
};
