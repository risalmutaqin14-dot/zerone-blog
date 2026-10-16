import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json } from '../../../../lib/posts';
import { revalidate } from '../../../../lib/revalidate';
import { parseCategory } from '../../../../lib/taxonomy';

export const GET: APIRoute = async () => {
  const { data, error } = await admin.from('categories').select('id,name,slug,description,created_at').order('name');
  return error ? dbError(error) : json(data);
};

export const POST: APIRoute = async ({ request }) => {
  const parsed = parseCategory(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin.from('categories').insert(parsed.data).select().single();
  if (error) return dbError(error);
  await revalidate({ type: 'category', slug: data.slug });
  return json(data, 201);
};
