// Hash password: scrypt (bawaan Node, memory-hard) + salt acak per password. Tanpa dependency.
// Format tersimpan: scrypt$N$r$p$salt$hash (parameter ikut disimpan, jadi bisa dinaikkan tanpa merusak hash lama).
// JS murni tanpa import `astro:*` supaya bisa dipakai script CLI dan tes.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128; // batas atas: cegah DoS lewat password raksasa

// maxmem harus > 128*N*r; kalau tidak scrypt melempar error.
const derive = (pw, salt, n, r, p) =>
  scryptAsync(pw.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 });

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await derive(pw, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(pw, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Email tidak ditemukan tetap menjalankan satu hash: waktu respons tidak membocorkan email yang terdaftar.
let dummy;
export async function burn(pw) {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(pw, await dummy);
}

// Return pesan error, atau '' kalau lolos.
export function validatePassword(pw, email = '') {
  if (typeof pw !== 'string') return 'Password tidak valid';
  if (pw.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter`;
  if (pw.length > PASSWORD_MAX) return `Password maksimal ${PASSWORD_MAX} karakter`;
  if (/^(.)\1+$/.test(pw)) return 'Password terlalu mudah ditebak';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return 'Password tidak boleh mengandung email';
  return '';
}
