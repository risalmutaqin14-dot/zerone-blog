import type { APIRoute } from 'astro';
import { fail, guard, ok, preflight, usedBy, withoutPosts } from '../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// Hanya kategori yang punya post terbit di website pemilik key.
export const GET: APIRoute = async ({ request }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;
  const { data, error } = await usedBy('categories', 'name,slug,description', site.id).order('name');
  return error ? fail(error.message, 500, request) : ok(withoutPosts(data), request);
};
