import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySession } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const p = ctx.url.pathname;
  const isApi = p.startsWith('/api/admin');
  if ((isApi || p.startsWith('/dashboard')) && !verifySession(ctx.cookies.get(SESSION_COOKIE)?.value)) {
    return isApi
      ? new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      : ctx.redirect('/login');
  }
  return next();
});
