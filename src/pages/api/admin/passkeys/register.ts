import type { APIRoute } from 'astro';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { admin } from '../../../../db/admin';
import { takeChallenge } from '../../../../lib/challenge.js';
import { PK_COOKIE, b64, rp } from '../../../../lib/passkey';
import { json } from '../../../../lib/posts';

// Langkah 2 daftar passkey. Challenge terikat ke user yang meminta di langkah 1.
export const POST: APIRoute = async ({ request, cookies, locals, url }) => {
  const me = locals.user!;
  const ch = takeChallenge(cookies.get(PK_COOKIE)?.value);
  cookies.delete(PK_COOKIE, { path: '/' });
  const body = await request.json().catch(() => null);
  if (ch?.purpose !== 'reg' || ch.userId !== me.id || !body?.response) return json({ error: 'Sesi pendaftaran kedaluwarsa. Ulangi.' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
  const { rpID, origin } = rp(url);
  let info;
  try {
    const r = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!r.verified) throw new Error('unverified');
    info = r.registrationInfo!;
  } catch {
    return json({ error: 'Passkey gagal diverifikasi' }, 400);
  }

  const { error } = await admin.from('passkeys').insert({
    user_id: me.id,
    credential_id: info.credential.id,
    public_key: b64(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ?? [],
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    name: name || 'Passkey',
  });
  if (error) return json({ error: error.code === '23505' ? 'Passkey ini sudah terdaftar' : 'Gagal menyimpan passkey' }, error.code === '23505' ? 409 : 500);
  return json({ ok: true });
};
