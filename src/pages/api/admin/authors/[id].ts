import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { SESSION_COOKIE, destroyUserSessions } from '../../../../lib/auth';
import { hashPassword, verifyPassword } from '../../../../lib/password.js';
import { revokeUserPasskeys } from '../../../../lib/passkeys';
import { canEditUser } from '../../../../lib/permissions.js';
import { json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';
import { revalidate, slugOf } from '../../../../lib/revalidate';
import { USER_COLS, parseUser, presentUser, userDbError } from '../../../../lib/users';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = () => json({ error: 'Author tidak ditemukan' }, 404);

export const GET: APIRoute = async ({ params, locals }) => {
  if (!UUID.test(params.id ?? '')) return bad();
  const { data, error } = await admin.from('authors').select(USER_COLS).eq('id', params.id!).maybeSingle();
  if (error) return userDbError(error);
  return data ? json(presentUser(data, locals.user!)) : bad();
};

export const PUT: APIRoute = async ({ request, params, locals, cookies }) => {
  const actor = locals.user!;
  const id = params.id ?? '';
  if (!UUID.test(id)) return bad();
  // Cek kepemilikan SEBELUM apa pun: admin tidak boleh mengubah user lain. Dilakukan di server, bukan cuma menyembunyikan tombol.
  if (!canEditUser(actor, id)) return json({ error: 'Forbidden' }, 403);

  const { data: target, error: e0 } = await admin.from('authors').select('id,slug,email,role,password_hash').eq('id', id).maybeSingle();
  if (e0) return userDbError(e0);
  if (!target) return bad();

  const body = await request.json().catch(() => null);
  const parsed = parseUser(body, { create: false, knownEmail: target.email ?? '' });
  if ('error' in parsed) return json(parsed, 400);

  const roleChange = parsed.role && parsed.role !== target.role ? parsed.role : undefined;
  if (roleChange && actor.role !== 'superadmin') return json({ error: 'Hanya superadmin yang boleh mengubah role' }, 403);

  const emailChange = parsed.email && parsed.email !== target.email ? parsed.email : undefined;
  const sensitive = !!(emailChange || parsed.password || roleChange);

  // Akun lama tanpa login: email & password harus dikirim bersamaan.
  const hadLogin = !!target.password_hash;
  if (!hadLogin && (parsed.email || parsed.password) && !(parsed.email && parsed.password)) {
    return json({ error: 'Email dan password harus diisi bersamaan untuk mengaktifkan login' }, 400);
  }

  // Re-autentikasi: ubah email/password/role butuh password PELAKU saat ini. Sesi curian saja tidak cukup.
  if (sensitive) {
    if (!hit(`reauth:${actor.id}`, 5, 15 * 60 * 1000)) return json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429);
    const { data: me } = await admin.from('authors').select('password_hash').eq('id', actor.id).maybeSingle();
    if (!parsed.currentPassword || !(await verifyPassword(parsed.currentPassword, me?.password_hash))) {
      return json({ error: 'Password saat ini salah' }, 403);
    }
  }

  // Whitelist eksplisit (anti mass assignment): hanya kolom ini yang bisa berubah.
  const update: Record<string, unknown> = { ...parsed.profile };
  if (emailChange) update.email = emailChange;
  if (parsed.password) update.password_hash = await hashPassword(parsed.password);
  if (roleChange) update.role = roleChange;
  if (parsed.password) Object.assign(update, { failed_attempts: 0, locked_until: null });

  const { error } = await admin.from('authors').update(update).eq('id', id);
  if (error) return userDbError(error);

  // Kredensial/role berubah -> sesi lain milik user ini dicabut. Sesi pelaku sendiri tetap hidup.
  // Password diganti -> passkey ikut dicabut (pencuri yang sempat mendaftarkan passkey tidak bertahan).
  if (parsed.password) await admin.from('passkeys').delete().eq('user_id', id);
  if (sensitive) await destroyUserSessions(id, id === actor.id ? cookies.get(SESSION_COOKIE)?.value : undefined);
  // Password baru -> semua passkey user ini dicabut (passkey yang sempat ditanam pemegang password lama ikut mati).
  if (parsed.password) await revokeUserPasskeys(id);

  const slug = parsed.profile.slug as string;
  await revalidate({ type: 'author', slug, oldSlug: target.slug !== slug ? target.slug : undefined });
  return json({ ok: true });
};

// Hanya superadmin; tidak boleh menghapus diri sendiri. Superadmin terakhir dilindungi trigger DB.
// FK `on delete restrict` -> 409 kalau masih dipakai post. Sesi ikut terhapus (cascade).
export const DELETE: APIRoute = async ({ params, locals }) => {
  const actor = locals.user!;
  const id = params.id ?? '';
  if (!UUID.test(id)) return bad();
  if (actor.role !== 'superadmin') return json({ error: 'Forbidden' }, 403);
  if (id === actor.id) return json({ error: 'Tidak bisa menghapus akun sendiri' }, 409);
  const slug = await slugOf('authors', id);
  const { error } = await admin.from('authors').delete().eq('id', id);
  if (error) return userDbError(error);
  if (slug) await revalidate({ type: 'author', slug });
  return json({ ok: true });
};
