import type { APIRoute } from 'astro';
import { admin } from '../../../db/admin';
import { SESSION_COOKIE, cookieOptions, createSession, destroySession } from '../../../lib/auth';
import { PASSWORD_MAX, burn, verifyPassword } from '../../../lib/password.js';
import { hit } from '../../../lib/rateLimit';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW = 15 * 60 * 1000;

// Semua kegagalan (email tak ada, password salah, akun terkunci) memberi pesan SAMA dan waktu respons
// mirip (burn() menjalankan hash palsu), supaya email terdaftar tidak bisa ditebak.
export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const fail = (code: string) => redirect(`/login?error=${code}`);

  let ip = 'unknown';
  try { ip = clientAddress; } catch { /* adapter tanpa alamat klien */ }
  if (!hit(`ip:${ip}`, 20, WINDOW)) return fail('rate');

  const form = await request.formData().catch(() => null);
  const email = String(form?.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(form?.get('password') ?? '').slice(0, PASSWORD_MAX);
  if (!email || !password) return fail('1');
  if (!hit(`em:${email}`, 10, WINDOW)) return fail('rate');

  const { data: u } = await admin
    .from('authors')
    .select('id,password_hash,failed_attempts,locked_until')
    .eq('email', email)
    .maybeSingle();

  const locked = !!u?.locked_until && new Date(u.locked_until) > new Date();
  if (!u?.password_hash || locked) {
    await burn(password);
    return fail('1');
  }

  if (!(await verifyPassword(password, u.password_hash))) {
    const n = u.failed_attempts + 1;
    // ponytail: counter baca-lalu-tulis bisa kalah balapan bila percobaan paralel; limiter memori menambal sebagian.
    await admin
      .from('authors')
      .update(n >= MAX_FAILS ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MS).toISOString() } : { failed_attempts: n })
      .eq('id', u.id);
    return fail('1');
  }

  if (u.failed_attempts || u.locked_until) {
    await admin.from('authors').update({ failed_attempts: 0, locked_until: null }).eq('id', u.id);
  }

  // Token baru tiap login (anti session fixation); sesi lama di browser ini dicabut.
  await destroySession(cookies.get(SESSION_COOKIE)?.value);
  cookies.set(SESSION_COOKIE, await createSession(u.id), cookieOptions);
  return redirect('/dashboard'); // tujuan tetap: tidak ada parameter redirect, jadi tidak ada open redirect
};
