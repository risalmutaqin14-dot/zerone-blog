import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { dbError, json } from '../../../../lib/posts';
import { parsePlan } from '../../../../lib/plans';

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = parsePlan(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin
    .from('content_plans')
    .insert({ ...parsed.data, source: 'manual', created_by: locals.user!.id })
    .select('id')
    .single();
  return error ? dbError(error) : json(data, 201);
};
