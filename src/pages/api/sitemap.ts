import type { APIRoute } from 'astro';
import { admin } from '../../db/admin';
import { fail, guard, ok, preflight, usedBy, withoutPosts } from '../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// Ringan, tanpa paginasi: hanya slug + lastmod untuk sitemap.xml di Next.js.
// Supabase membatasi 1000 baris/request default -> naikkan range kalau post > 1000.
export const GET: APIRoute = async ({ request }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;

  const [posts, categories, authors] = await Promise.all([
    admin
      .from('posts')
      .select('slug,updated_at,published_at,category:categories(slug)')
      .eq('website_id', site.id)
      .eq('status', 'published')
      .eq('noindex', false)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .range(0, 9999),
    usedBy('categories', 'slug', site.id),
    usedBy('authors', 'slug', site.id),
  ]);
  const err = posts.error ?? categories.error ?? authors.error;
  if (err) return fail(err.message, 500, request);

  return ok({
    posts: posts.data,
    categories: withoutPosts(categories.data)?.map((c) => c.slug),
    authors: withoutPosts(authors.data)?.map((a) => a.slug),
  }, request);
};
