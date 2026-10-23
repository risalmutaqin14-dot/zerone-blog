import type { APIRoute } from 'astro';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { admin } from '../../../../db/admin';
import { SESSION_COOKIE, cookieOptions, createSession, destroySession } from '../../../../lib/auth';
import { json } from '../../../../lib/posts';
import { rp, takeFlow } from '../../../../lib/passkeys';
import { hit } from '../../../../lib/rateLimit';

// Langkah 2 login passkey: cek tanda tangan perangkat, lalu buat sesi seperti login password.
// Semua kegagalan memberi pesan yang sama (passkey tak dikenal / tanda tangan salah / challenge basi).
const fail = () => json({ error: 'Passkey tidak dikenali atau gagal diverifikasi. Coba lagi, atau masuk dengan password.' }, 401);

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  let ip = 'unknown';
  try { ip = clientAddress; } catch { /* adapter tanpa alamat klien */ }
  if (!hit(`pk:${ip}`, 20, 15 * 60 * 1000)) return json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' }, 429);

  const flow = takeFlow(cookies, 'login');
  const response = (await request.json().catch(() => null))?.response;
  if (!flow || typeof response?.id !== 'string' || response.id.length > 1024) return fail();

  const { data: pk } = await admin
    .from('passkeys')
    .select('id,user_id,credential_id,public_key,counter,transports,user:authors(id,email)')
    .eq('credential_id', response.id)
    .maybeSingle();
  const user = pk?.user as { id: string; email: string | null } | undefined;
  if (!pk || !user?.email) return fail(); // akun tanpa login (author lama) tidak bisa masuk

  // userHandle (bila dikirim perangkat) harus milik user yang sama dengan pemilik passkey.
  const handle = response.response?.userHandle;
  if (handle) {
    let owner = '';
    try { owner = isoBase64URL.toUTF8String(String(handle)); } catch { /* handle rusak */ }
    if (owner !== pk.user_id) return fail();
  }

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: flow.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
    credential: {
      id: pk.credential_id,
      publicKey: isoBase64URL.toBuffer(pk.public_key),
      counter: Number(pk.counter),
      transports: pk.transports ?? undefined,
    },
  }).catch(() => null); // counter mundur (perangkat dikloning), origin/RP salah, tanda tangan salah
  if (!result?.verified) return fail();

  await admin
    .from('passkeys')
    .update({ counter: result.authenticationInfo.newCounter, backed_up: result.authenticationInfo.credentialBackedUp, last_used_at: new Date().toISOString() })
    .eq('id', pk.id);

  // Token baru tiap login (anti session fixation); sesi lama di browser ini dicabut.
  await destroySession(cookies.get(SESSION_COOKIE)?.value);
  cookies.set(SESSION_COOKIE, await createSession(pk.user_id), cookieOptions);
  return json({ ok: true, redirect: '/dashboard' });
};
