import { createHash, randomBytes } from 'node:crypto';
import { admin } from '../db/admin';
import type { Role } from './permissions.js';

// Prefix __Host- = browser menolak cookie yang tidak Secure, punya Domain, atau Path bukan '/'.
// Hanya di produksi (HTTPS); di dev http cookie ber-prefix itu akan ditolak.
export const SESSION_COOKIE = import.meta.env.PROD ? '__Host-session' : 'session';

const IDLE_MS = 8 * 60 * 60 * 1000; // sesi mati kalau 8 jam tak dipakai
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // dan paling lama 7 hari sejak login
export const SESSION_MAX_AGE = IDLE_MS / 1000;

export type SessionUser = { id: string; name: string; email: string; role: Role };

// Token acak 256-bit di cookie; DB hanya menyimpan hash-nya. Dump DB tidak cukup untuk membajak sesi.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const { error } = await admin
    .from('sessions')
    .insert({ id: hashToken(token), user_id: userId, expires_at: new Date(Date.now() + IDLE_MS).toISOString() });
  if (error) throw new Error(`Gagal membuat sesi: ${error.message}`);
  admin.from('sessions').delete().lt('expires_at', new Date().toISOString()).then(() => {}); // sapu sesi kedaluwarsa
  return token;
}

/** user + refresh=true bila cookie perlu diperpanjang (sliding). User & role dibaca ulang dari DB di tiap request. */
export async function getSession(token?: string): Promise<{ user: SessionUser; refresh: boolean } | null> {
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const { data } = await admin
    .from('sessions')
    .select('expires_at,created_at,user:authors(id,name,email,role)')
    .eq('id', id)
    .maybeSingle();
  const user = data?.user as any;
  if (!data || !user?.email) return null;

  const now = Date.now();
  const hardEnd = new Date(data.created_at).getTime() + ABSOLUTE_MS;
  if (new Date(data.expires_at).getTime() < now || hardEnd < now) {
    await admin.from('sessions').delete().eq('id', id);
    return null;
  }
  let refresh = false;
  if (new Date(data.expires_at).getTime() - now < IDLE_MS / 2) {
    await admin.from('sessions').update({ expires_at: new Date(Math.min(now + IDLE_MS, hardEnd)).toISOString() }).eq('id', id);
    refresh = true;
  }
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, refresh };
}

export const destroySession = (token?: string) =>
  token ? admin.from('sessions').delete().eq('id', hashToken(token)) : Promise.resolve();

/** Cabut semua sesi user (ganti password/email). exceptToken = sesi yang sedang dipakai, tetap hidup. */
export async function destroyUserSessions(userId: string, exceptToken?: string) {
  let q = admin.from('sessions').delete().eq('user_id', userId);
  if (exceptToken) q = q.neq('id', hashToken(exceptToken));
  await q;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: import.meta.env.PROD,
  path: '/',
  maxAge: SESSION_MAX_AGE,
};
