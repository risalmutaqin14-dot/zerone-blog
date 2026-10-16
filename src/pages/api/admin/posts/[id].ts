import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json, parsePost } from '../../../../lib/posts';
import { revalidate, revalidatePost } from '../../../../lib/revalidate';

export const GET: APIRoute = async ({ params }) => {
  const { data, error } = await admin
    .from('posts')
    .select('id,title,slug,excerpt,content,cover_url,cover_alt,meta_title,meta_description,tags,status,published_at,created_at,updated_at,category:categories(name),author:authors(name),website:websites(name),canonical_url,og_image,noindex,cover_width,cover_height')
    .eq('id', params.id!)
    .maybeSingle();
  if (error) return dbError(error);
  return data ? json(data) : json({ error: 'Post tidak ditemukan' }, 404);
};

export const PUT: APIRoute = async ({ request, params }) => {
  const parsed = await parsePost(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const id = params.id!;
  const newSlug = parsed.data.slug as string;

  const { data: prev } = await admin.from('posts').select('slug,website_id').eq('id', id).maybeSingle();
  if (!prev) return json({ error: 'Post tidak ditemukan' }, 404);

  const changed = prev.slug !== newSlug;
  const moved = prev.website_id !== parsed.data.website_id;

  const { data, error } = await admin.from('posts').update(parsed.data).eq('id', id).select('id').maybeSingle();
  if (error) return dbError(error);
  if (!data) return json({ error: 'Post tidak ditemukan' }, 404);

  if (changed) {
    // Slug baru bisa pernah jadi slug lama post ini: hapus supaya tidak redirect ke diri sendiri.
    await admin.from('slug_history').delete().eq('old_slug', newSlug).eq('post_id', id);
    const { error: hErr } = await admin.from('slug_history').upsert({ old_slug: prev.slug, post_id: id });
    if (hErr) console.error('slug_history gagal:', hErr.message);
  }
  // Dipindah website: situs lama juga harus membuang post ini dari cache-nya.
  await revalidatePost(id, newSlug, changed ? prev.slug : undefined, moved ? [prev.website_id] : []);
  return json(data);
};

export const DELETE: APIRoute = async ({ params }) => {
  const { data: prev } = await admin.from('posts').select('slug,website_id').eq('id', params.id!).maybeSingle();
  const { error } = await admin.from('posts').delete().eq('id', params.id!);
  if (error) return dbError(error);
  if (prev) await revalidate({ type: 'post', slug: prev.slug }, [prev.website_id]);
  return json({ ok: true });
};
