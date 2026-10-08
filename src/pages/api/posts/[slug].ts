import type { APIRoute } from 'astro';
import { admin } from '../../../db/admin';
import { fail, guard, ok, preflight } from '../../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = async ({ request, params }) => {
  const denied = guard(request);
  if (denied) return denied;

  const { data, error } = await admin
    .from('posts')
    .select('id,title,slug,excerpt,content,cover_url,tags,published_at,updated_at,category:categories(name,slug)')
    .eq('slug', params.slug!)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (error) return fail(error.message, 500);
  return data ? ok(data) : fail('Not found', 404);
};
