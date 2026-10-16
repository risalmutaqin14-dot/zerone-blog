import type { APIRoute } from 'astro';
import { admin } from '../../../db/admin';
import { fail, guard, moved, ok, preflight } from '../../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

export const GET: APIRoute = async ({ request, params }) => {
  const site = await guard(request);
  if (site instanceof Response) return site;

  const slug = params.slug!;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('posts')
    .select('id,title,slug,excerpt,content,cover_url,cover_alt,cover_width,cover_height,meta_title,meta_description,canonical_url,og_image,noindex,tags,published_at,updated_at,author:authors(name,slug,bio,avatar_url,links),category:categories(name,slug,description)')
    .eq('website_id', site.id)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', now)
    .maybeSingle();
  if (error) return fail(error.message, 500, request);
  if (data) return ok(data, request);

  // Slug lama -> beri tahu frontend slug barunya (hanya post milik website ini).
  const { data: hist } = await admin
    .from('slug_history')
    .select('post:posts!inner(slug,status,published_at,website_id)')
    .eq('old_slug', slug)
    .eq('post.website_id', site.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const p: any = hist?.post;
  if (p?.status === 'published' && p.published_at <= now) return moved(p.slug, request);
  return fail('Not found', 404, request);
};
