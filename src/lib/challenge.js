// Challenge WebAuthn sekali pakai, 5 menit. Kuncinya acak di cookie httpOnly; isinya di memori proses.
// ponytail: memori satu proses (cukup untuk adapter node standalone). Multi-instance: pindah ke tabel DB.
import { randomBytes } from 'node:crypto';

const TTL = 5 * 60 * 1000;
const store = new Map();

/** @param {object} data @returns {string} kunci untuk cookie */
export function putChallenge(data) {
  const now = Date.now();
  if (store.size > 1000) for (const [k, v] of store) if (v.exp < now) store.delete(k);
  const id = randomBytes(18).toString('base64url');
  store.set(id, { data, exp: now + TTL });
  return id;
}

/** Ambil lalu hapus (tak bisa dipakai ulang). null bila tak ada / kedaluwarsa. @param {string} [id] */
export function takeChallenge(id) {
  if (!id) return null;
  const v = store.get(id);
  store.delete(id);
  return v && v.exp > Date.now() ? v.data : null;
}
