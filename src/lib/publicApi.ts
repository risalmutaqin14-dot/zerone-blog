import { createHash } from 'node:crypto';
import { admin } from '../db/admin';
import { json } from './posts';

export type Site = { id: string; name: string; allowed_origin: string };

// Key disimpan sebagai hash: kebocoran DB tidak membocorkan key.
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

// website -> request yang sudah lolos guard(), supaya CORS mengikuti origin website itu.
const sites = new WeakMap<Request, Site>();

// allowed_origin: daftar dipisah koma (mis. latihan.id dan www.latihan.id adalah dua origin).
const cors = (request?: Request): Record<string, string> => {
  const site = request && sites.get(request);
  const origin = request?.headers.get('origin') ?? '';
  const allow = site ? (site.allowed_origin.split(',').includes(origin) ? origin : '') : '*';
  return {
    ...(allow && { 'Access-Control-Allow-Origin': allow }),
    'Access-Control-Allow-Headers': 'x-api-key, if-none-match',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin, x-api-key',
  };
};

// Preflight tanpa API key: '*' aman, response asli (dengan key) tetap dibatasi ke origin website.
export const preflight = () => new Response(null, { status: 204, headers: cors() });

// Return website pemilik key, atau Response 401/500. Semua query publik wajib di-scope ke Site.id.
export async function guard(request: Request): Promise<Site | Response> {
  const key = request.headers.get('x-api-key');
  if (key) {
    const { data, error } = await admin
      .from('websites')
      .select('id,name,allowed_origin')
      .eq('api_key_hash', hashKey(key))
      .maybeSingle();
    if (error) return json({ error: error.message }, 500, cors(request));
    if (data) {
      sites.set(request, data);
      return data;
    }
  }
  return json({ error: 'Unauthorized' }, 401, cors(request));
}

// Category/author yang punya post terbit di website ini (nama taxonomy website lain tidak bocor).
export const usedBy = (table: 'categories' | 'authors', cols: string, siteId: string) =>
  admin
    .from(table)
    .select(`${cols},posts!inner(id)`)
    .eq('posts.website_id', siteId)
    .eq('posts.status', 'published')
    .lte('posts.published_at', new Date().toISOString());

export const withoutPosts = (rows: any[] | null) => rows?.map(({ posts: _p, ...r }) => r);

// Sukses + Cache-Control + ETag. Kirim `request` supaya If-None-Match dibalas 304 tanpa body.
// s-maxage pendek: webhook revalidate yang menyegarkan, ini hanya jaring pengaman.
// Vary x-api-key (di cors) memastikan cache CDN tidak mencampur isi antar website.
export const ok = (data: unknown, request?: Request) => {
  const body = JSON.stringify(data);
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  const headers = { ...cors(request), 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', ETag: etag };
  if (request?.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });
};

export const fail = (error: string, status: number, request?: Request) => json({ error }, status, cors(request));
// Slug lama: 404 + redirect_to. Frontend yang memutuskan 301 (fetch otomatis mengikuti 3xx, jadi sengaja bukan 3xx).
export const moved = (to: string, request?: Request) => json({ error: 'Moved', redirect_to: to }, 404, cors(request));
