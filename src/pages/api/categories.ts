import type { APIRoute } from 'astro';
import { admin } from '../../db/admin';
import { fail, guard, ok, preflight } from '../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = async ({ request }) => {
  const denied = guard(request);
  if (denied) return denied;
  const { data, error } = await admin.from('categories').select('name,slug').order('name');
  return error ? fail(error.message, 500) : ok(data);
};
