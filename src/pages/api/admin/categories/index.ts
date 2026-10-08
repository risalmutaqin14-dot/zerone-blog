import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json } from '../../../../lib/posts';
import { slugify } from '../../../../lib/slug.js';

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  const name = String(b?.name ?? '').trim().slice(0, 60);
  const slug = slugify(b?.slug || name);
  if (!name || !slug) return json({ error: 'Nama wajib diisi' }, 400);
  const { data, error } = await admin.from('categories').insert({ name, slug }).select().single();
  return error ? dbError(error) : json(data, 201);
};
