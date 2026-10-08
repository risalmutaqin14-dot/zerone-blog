import { ALLOWED_ORIGIN, NEXT_API_KEY } from 'astro:env/server';
import { json } from './posts';

const cors = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  Vary: 'Origin',
});

export const preflight = () => new Response(null, { status: 204, headers: cors() });

// Return Response kalau API key salah, null kalau lolos.
export const guard = (request: Request) =>
  request.headers.get('x-api-key') === NEXT_API_KEY ? null : json({ error: 'Unauthorized' }, 401, cors());

export const ok = (data: unknown) => json(data, 200, cors());
export const fail = (error: string, status: number) => json({ error }, status, cors());
