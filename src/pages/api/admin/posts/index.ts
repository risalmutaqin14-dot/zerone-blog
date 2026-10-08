import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json, parsePost } from '../../../../lib/posts';

export const POST: APIRoute = async ({ request }) => {
  const parsed = parsePost(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin.from('posts').insert(parsed.data).select('id').single();
  return error ? dbError(error) : json(data, 201);
};
