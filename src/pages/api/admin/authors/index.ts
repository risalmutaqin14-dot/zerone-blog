import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { json } from '../../../../lib/posts';
import { hashPassword, verifyPassword } from '../../../../lib/password.js';
import { hit } from '../../../../lib/rateLimit';
import { revalidate } from '../../../../lib/revalidate';
import { USER_COLS, parseUser, presentUser, userDbError } from '../../../../lib/users';

// Semua user boleh melihat daftar. Email user lain disembunyikan oleh presentUser.
export const GET: APIRoute = async ({ locals }) => {
  const { data, error } = await admin.from('authors').select(USER_COLS).order('name');
  return error ? userDbError(error) : json(data.map((r) => presentUser(r, locals.user!)));
};

// Hanya superadmin. (Middleware sudah memblokir admin di path lain, ini pengecekan eksplisit per-aksi.)
export const POST: APIRoute = async ({ request, locals }) => {
  const actor = locals.user!;
  if (actor.role !== 'superadmin') return json({ error: 'Forbidden' }, 403);
  const parsed = parseUser(await request.json().catch(() => null), { create: true });
  if ('error' in parsed) return json(parsed, 400);

  // Membuat akun (apalagi superadmin) = aksi sensitif: wajib password pelaku, sesi curian saja tidak cukup.
  if (!hit(`reauth:${actor.id}`, 5, 15 * 60 * 1000)) return json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429);
  const { data: me } = await admin.from('authors').select('password_hash').eq('id', actor.id).maybeSingle();
  if (!parsed.currentPassword || !(await verifyPassword(parsed.currentPassword, me?.password_hash))) {
    return json({ error: 'Password Anda saat ini salah' }, 403);
  }

  const { data, error } = await admin
    .from('authors')
    .insert({
      ...parsed.profile,
      email: parsed.email,
      password_hash: await hashPassword(parsed.password!),
      role: parsed.role ?? 'admin', // default paling rendah
    })
    .select(USER_COLS)
    .single();
  if (error) return userDbError(error);
  await revalidate({ type: 'author', slug: data.slug });
  return json(presentUser(data, locals.user!), 201);
};
