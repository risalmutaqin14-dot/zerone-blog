import type { APIRoute } from 'astro';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { admin } from '../../../../db/admin';
import { MAX_PASSKEYS, PASSKEY_COLS, cleanName, rp, takeFlow } from '../../../../lib/passkeys';
import { json } from '../../../../lib/posts';

// Passkey milik akun yang sedang login saja (tidak ada akses ke passkey user lain, termasuk superadmin).
export const GET: APIRoute = async ({ locals }) => {
  const { data, error } = await admin.from('passkeys').select(PASSKEY_COLS).eq('user_id', locals.user!.id).order('created_at');
  if (error) return json({ error: 'Passkey belum tersedia (tabel passkeys belum dibuat).' }, 503);
  return json(data);
};

// Langkah 2 menambah passkey: verifikasi hasil navigator.credentials.create() lalu simpan public key-nya.
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const actor = locals.user!;
  const flow = takeFlow(cookies, 'register');
  if (!flow || flow.userId !== actor.id) return json({ error: 'Waktu habis. Ulangi tambah passkey.' }, 400);

  const body = await request.json().catch(() => null);
  const result = await verifyRegistrationResponse({
    response: body?.response,
    expectedChallenge: flow.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return json({ error: 'Passkey gagal diverifikasi. Coba lagi.' }, 400);

  const { count } = await admin.from('passkeys').select('id', { count: 'exact', head: true }).eq('user_id', actor.id);
  if ((count ?? 0) >= MAX_PASSKEYS) return json({ error: `Maksimal ${MAX_PASSKEYS} passkey per akun.` }, 409);

  const info = result.registrationInfo;
  const { data, error } = await admin
    .from('passkeys')
    .insert({
      user_id: actor.id,
      credential_id: info.credential.id,
      public_key: isoBase64URL.fromBuffer(info.credential.publicKey),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      device_type: info.credentialDeviceType,
      backed_up: info.credentialBackedUp,
      name: cleanName(body?.name),
    })
    .select(PASSKEY_COLS)
    .single();
  if (error?.code === '23505') return json({ error: 'Passkey ini sudah terdaftar.' }, 409);
  if (error) return json({ error: 'Gagal menyimpan passkey.' }, 500);
  return json(data, 201);
};
