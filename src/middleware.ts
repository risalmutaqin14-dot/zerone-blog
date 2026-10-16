import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, cookieOptions, getSession } from './lib/auth';
import { canAccessPath } from './lib/permissions.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const jsonError = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const onRequest = defineMiddleware(async (ctx, next) => {
  const p = ctx.url.pathname;
  const isApi = p.startsWith('/api/admin');
  const isDash = p.startsWith('/dashboard');
  const isAuth = p.startsWith('/api/auth');
  ctx.locals.user = null;

  // CSRF lapis kedua (selain SameSite=Lax): browser selalu mengirim Sec-Fetch-Site. Request tulis dari
  // origin/situs lain ditolak. Tidak bergantung pada Host/proxy, jadi aman di balik reverse proxy.
  if ((isApi || isAuth) && UNSAFE.has(ctx.request.method)) {
    const site = ctx.request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') return jsonError('Forbidden', 403);
  }

  if (isApi || isDash) {
    const session = await getSession(ctx.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return isApi ? jsonError('Unauthorized', 401) : ctx.redirect('/login');
    }
    // Default-deny per role. Admin hanya boleh path yang di-allowlist; selain itu 403 / balik ke Overview.
    if (!canAccessPath(session.user.role, p)) {
      return isApi ? jsonError('Forbidden', 403) : ctx.redirect('/dashboard');
    }
    ctx.locals.user = session.user;
    if (session.refresh) ctx.cookies.set(SESSION_COOKIE, ctx.cookies.get(SESSION_COOKIE)!.value, cookieOptions);
  }

  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  if (import.meta.env.PROD) res.headers.set('Strict-Transport-Security', 'max-age=15552000');
  if (isApi || isDash || isAuth || p === '/login') {
    // Admin tidak boleh terindeks, di-iframe (clickjacking), atau tersimpan di cache/back-button setelah logout.
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'same-origin');
    res.headers.set('Cache-Control', 'no-store');
  } else {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow'); // perilaku lama: seluruh host admin tak terindeks
  }
  return res;
});
