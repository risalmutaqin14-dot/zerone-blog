import type { APIRoute } from 'astro';
import { SESSION_COOKIE, destroySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(cookies.get(SESSION_COOKIE)?.value); // cabut di server, bukan sekadar hapus cookie
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login');
};
