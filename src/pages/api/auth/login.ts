import type { APIRoute } from 'astro';
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, createSession } from '../../../lib/auth';

// ponytail: tanpa rate limit; tambah (mis. per IP) kalau dashboard dibuka ke publik.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  if (!checkPassword(String(form.get('password') ?? ''))) return redirect('/login?error=1');
  cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return redirect('/dashboard');
};
