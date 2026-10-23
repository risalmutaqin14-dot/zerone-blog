import type { APIRoute } from 'astro';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { admin } from '../../../../db/admin';
import { verifyPassword } from '../../../../lib/password.js';
import { MAX_PASSKEYS, rp, startFlow } from '../../../../lib/passkeys';
import { json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';

// Langkah 1 menambah passkey untuk akun SENDIRI. Wajib password saat ini (sesi curian saja tidak cukup
// untuk menanam passkey). Challenge yang keluar hanya berlaku untuk satu passkey dan 5 menit.
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const actor = locals.user!;
  if (!hit(`reauth:${actor.id}`, 5, 15 * 60 * 1000)) return json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429);

  const { currentPassword } = (await request.json().catch(() => null)) ?? {};
  const { data: me } = await admin.from('authors').select('id,name,email,password_hash').eq('id', actor.id).maybeSingle();
  if (!me?.email || typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, me.password_hash))) {
    return json({ error: 'Password saat ini salah' }, 403);
  }

  const { data: existing, error } = await admin.from('passkeys').select('credential_id,transports').eq('user_id', actor.id);
  if (error) return json({ error: 'Passkey belum tersedia (tabel passkeys belum dibuat).' }, 503);
  if (existing.length >= MAX_PASSKEYS) return json({ error: `Maksimal ${MAX_PASSKEYS} passkey per akun. Hapus yang tidak dipakai dulu.` }, 409);

  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: me.email,
    userDisplayName: me.name,
    userID: isoUint8Array.fromUTF8String(me.id), // userHandle = id author, dicek lagi saat login
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports ?? undefined })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    timeout: 120_000,
  });
  startFlow(cookies, { challenge: options.challenge, purpose: 'register', userId: actor.id });
  return json(options, 200, { 'Cache-Control': 'no-store' });
};
