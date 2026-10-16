import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json } from '../../../../lib/posts';
import { revalidate, slugOf } from '../../../../lib/revalidate';
import { parseCategory } from '../../../../lib/taxonomy';

export const GET: APIRoute = async ({ params }) => {
  const { data, error } = await admin.from('categories').select('id,name,slug,description,created_at').eq('id', params.id!).maybeSingle();
  if (error) return dbError(error);
  return data ? json(data) : json({ error: 'Kategori tidak ditemukan' }, 404);
};

export const PUT: APIRoute = async ({ request, params }) => {
  const parsed = parseCategory(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const oldSlug = await slugOf('categories', params.id!);
  const { error } = await admin.from('categories').update(parsed.data).eq('id', params.id!);
  if (error) return dbError(error);
  const slug = parsed.data.slug as string;
  await revalidate({ type: 'category', slug, oldSlug: oldSlug !== slug ? oldSlug : undefined });
  return json({ ok: true });
};

// FK `on delete restrict` -> 409 kalau masih dipakai post.
export const DELETE: APIRoute = async ({ params }) => {
  const slug = await slugOf('categories', params.id!);
  const { error } = await admin.from('categories').delete().eq('id', params.id!);
  if (error) return dbError(error);
  if (slug) await revalidate({ type: 'category', slug });
  return json({ ok: true });
};
