import type { APIRoute } from 'astro';
import { ok, preflight } from '../../lib/publicApi';

export const OPTIONS: APIRoute = () => preflight();

// Daftar endpoint publik. Tanpa API key: tidak ada data sensitif. Detail lengkap: docs/API.md.
export const GET: APIRoute = ({ request }) =>
  ok({
    name: 'blog-zerone API',
    auth: 'Header x-api-key',
    endpoints: [
      'GET /api/posts?page&limit&category&author&tag&q',
      'GET /api/posts/:slug',
      'GET /api/categories',
      'GET /api/categories/:slug',
      'GET /api/authors',
      'GET /api/authors/:slug',
      'GET /api/tags',
      'GET /api/sitemap',
    ],
  }, request);
