import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json } from '../../../../lib/posts';
import { slugify } from '../../../../lib/slug.js';

export const PUT: APIRoute = async ({ request, params }) => {
  const b = await request.json().catch(() => null);
  const name = String(b?.name ?? '').trim().slice(0, 60);
  const slug = slugify(b?.slug || name);
  if (!name || !slug) return json({ error: 'Nama wajib diisi' }, 400);
  const { error } = await admin.from('categories').update({ name, slug }).eq('id', params.id!);
  return error ? dbError(error) : json({ ok: true });
};

// FK `on delete restrict` -> 409 kalau masih dipakai post.
export const DELETE: APIRoute = async ({ params }) => {
  const { error } = await admin.from('categories').delete().eq('id', params.id!);
  return error ? dbError(error) : json({ ok: true });
};
