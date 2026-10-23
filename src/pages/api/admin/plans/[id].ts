import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { UUID, dbError, json } from '../../../../lib/posts';
import { PLAN_STATUS, parsePlan } from '../../../../lib/plans';

export const PUT: APIRoute = async ({ request, params }) => {
  if (!UUID.test(params.id ?? '')) return json({ error: 'Invalid ID' }, 400);
  const parsed = parsePlan(await request.json().catch(() => null));
  if ('error' in parsed) return json(parsed, 400);
  const { data, error } = await admin
    .from('content_plans')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id!)
    .select('id');
  if (error) return dbError(error);
  return data?.length ? json({ ok: true }) : json({ error: 'Plan not found' }, 404);
};

// Status-only update ("Mark as done" in the plan list).
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!UUID.test(params.id ?? '')) return json({ error: 'Invalid ID' }, 400);
  const status = (await request.json().catch(() => null))?.status;
  if (!(PLAN_STATUS as readonly string[]).includes(status)) return json({ error: 'Invalid status' }, 400);
  const { data, error } = await admin
    .from('content_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', params.id!)
    .select('id');
  if (error) return dbError(error);
  return data?.length ? json({ ok: true }) : json({ error: 'Plan not found' }, 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!UUID.test(params.id ?? '')) return json({ error: 'Invalid ID' }, 400);
  const { error } = await admin.from('content_plans').delete().eq('id', params.id!);
  return error ? dbError(error) : json({ ok: true });
};
