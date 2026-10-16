import type { APIRoute } from 'astro';
import { fail, guard, ok, preflight, usedBy, withoutPosts } from '../../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = async ({ request, params }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;
  const { data, error } = await usedBy('categories', 'name,slug,description', site.id).eq('slug', params.slug!);
  if (error) return fail(error.message, 500, request);
  const [row] = withoutPosts(data) ?? [];
  return row ? ok(row, request) : fail('Not found', 404, request);
};
