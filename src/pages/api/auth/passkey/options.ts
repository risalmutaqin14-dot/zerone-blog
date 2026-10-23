import type { APIRoute } from 'astro';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { json } from '../../../../lib/posts';
import { rp, startFlow } from '../../../../lib/passkeys';
import { hit } from '../../../../lib/rateLimit';

// Langkah 1 login passkey: challenge baru. allowCredentials kosong = browser menawarkan passkey yang
// tersimpan untuk situs ini (tanpa mengetik email). Juga dipanggil diam-diam untuk autofill di halaman login.
export const POST: APIRoute = async ({ cookies, clientAddress }) => {
  let ip = 'unknown';
  try { ip = clientAddress; } catch { /* adapter tanpa alamat klien */ }
  if (!hit(`pk-opt:${ip}`, 60, 15 * 60 * 1000)) return json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429);

  const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: 'required', timeout: 120_000 });
  startFlow(cookies, { challenge: options.challenge, purpose: 'login' });
  return json(options, 200, { 'Cache-Control': 'no-store' });
};
