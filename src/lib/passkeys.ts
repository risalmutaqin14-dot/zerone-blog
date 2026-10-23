// Login passkey (WebAuthn): sidik jari, Face ID, PIN perangkat, atau security key.
// - Verifikasi pengguna WAJIB (requireUserVerification), jadi satu passkey = dua faktor.
// - Passkey "discoverable": di halaman login tidak perlu mengetik email.
// - Menambah passkey butuh password saat ini; satu konfirmasi = satu passkey.
// - Semua passkey user dicabut setiap kali password-nya diganti (authors/[id].ts, create-superadmin.mjs).
// - RP ID = host persis dari WEBAUTHN_ORIGIN / site (astro.zerone.id). Ganti domain = passkey lama tidak berlaku.
import { randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { WEBAUTHN_ORIGIN } from 'astro:env/server';
import { admin } from '../db/admin';

const ORIGIN = (WEBAUTHN_ORIGIN || (import.meta.env.DEV ? 'http://localhost:4321' : import.meta.env.SITE || '')).replace(/\/+$/, '');
export const rp = { name: 'Blog Zerone CMS', origin: ORIGIN, id: ORIGIN ? new URL(ORIGIN).hostname : '' };

export const MAX_PASSKEYS = 10;
export const PASSKEY_COLS = 'id,name,device_type,backed_up,created_at,last_used_at';

// ---------- challenge sekali pakai ----------
// Disimpan di memori proses (satu proses Node, sama seperti rateLimit.ts) dan diikat ke cookie httpOnly.
// Restart di tengah login = user tinggal mengulang. Kalau aplikasi jadi multi-instance, pindahkan ke DB.
type Flow = { challenge: string; purpose: 'login' | 'register'; userId?: string; exp: number };
const flows = new Map<string, Flow>();
const FLOW_COOKIE = import.meta.env.PROD ? '__Host-passkey' : 'passkey';
const FLOW_TTL_MS = 5 * 60 * 1000;

export function startFlow(cookies: AstroCookies, flow: Omit<Flow, 'exp'>) {
  const now = Date.now();
  if (flows.size > 2000) for (const [k, v] of flows) if (v.exp < now) flows.delete(k);
  if (flows.size > 5000) flows.clear(); // banjir permintaan: lebih baik semua mengulang daripada memori terus naik
  const token = randomBytes(24).toString('base64url');
  flows.set(token, { ...flow, exp: now + FLOW_TTL_MS });
  cookies.set(FLOW_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: import.meta.env.PROD, path: '/', maxAge: FLOW_TTL_MS / 1000 });
}

/** Ambil dan hapus challenge (tidak bisa dipakai dua kali). null = tidak ada, kedaluwarsa, atau beda tujuan. */
export function takeFlow(cookies: AstroCookies, purpose: Flow['purpose']): Flow | null {
  const token = cookies.get(FLOW_COOKIE)?.value;
  cookies.delete(FLOW_COOKIE, { path: '/', secure: import.meta.env.PROD }); // __Host- cookie hanya terhapus bila Secure
  if (!token) return null;
  const flow = flows.get(token);
  flows.delete(token);
  return flow && flow.purpose === purpose && flow.exp > Date.now() ? flow : null;
}

/** Nama passkey dari user: teks pendek satu baris. */
export const cleanName = (v: unknown) =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Passkey';

export const revokeUserPasskeys = (userId: string) => admin.from('passkeys').delete().eq('user_id', userId);
