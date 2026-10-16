import { admin } from '../db/admin';
import { dbError, json } from './posts';
import { validatePassword } from './password.js';
import { parseAuthor } from './taxonomy';
import type { Role } from './permissions.js';

export const ROLES: Role[] = ['superadmin', 'admin'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;

export type UserInput =
  | { error: string }
  | { profile: Record<string, unknown>; email?: string; password?: string; currentPassword?: string; role?: Role };

/**
 * Validasi body user. `create`: email + password wajib.
 * Edit: email/password/role hanya diproses kalau dikirim. password kosong = tidak diganti.
 */
export function parseUser(b: any, { create, knownEmail = '' }: { create: boolean; knownEmail?: string }): UserInput {
  const p = parseAuthor(b);
  if ('error' in p) return p;

  const rawEmail = String(b?.email ?? '').trim().toLowerCase();
  let email: string | undefined;
  if (rawEmail || create) {
    if (rawEmail.length > 254 || !EMAIL.test(rawEmail)) return { error: 'Email tidak valid' };
    email = rawEmail;
  }

  const password = typeof b?.password === 'string' ? b.password : '';
  if (password || create) {
    const e = validatePassword(password, email ?? knownEmail);
    if (e) return { error: e };
  }

  const rawRole = String(b?.role ?? '');
  if (rawRole && !ROLES.includes(rawRole as Role)) return { error: 'Role tidak valid' };

  return {
    profile: p.data,
    email,
    password: password || undefined,
    currentPassword: typeof b?.current_password === 'string' ? b.current_password.slice(0, 129) : undefined,
    role: (rawRole as Role) || undefined,
  };
}

// Email tidak ikut keluar untuk user lain (PII); hanya diri sendiri dan superadmin. Hash TIDAK PERNAH dikirim.
export function presentUser(row: any, actor: { id: string; role: Role }) {
  const { email, ...rest } = row;
  const self = row.id === actor.id;
  const sup = actor.role === 'superadmin';
  return { ...rest, has_login: !!email, ...(self || sup ? { email } : {}), can_edit: self || sup, can_delete: sup && !self };
}

export const userDbError = (e: { code?: string; message: string }) =>
  e.code === '23505' && /email/i.test(e.message) ? json({ error: 'Email sudah dipakai' }, 409)
  : e.code === 'P0001' ? json({ error: 'Tidak boleh menghapus atau menurunkan superadmin terakhir' }, 409) // trigger guard_last_superadmin
  : dbError(e);

export const USER_COLS = 'id,name,slug,bio,avatar_url,links,email,role,created_at';
