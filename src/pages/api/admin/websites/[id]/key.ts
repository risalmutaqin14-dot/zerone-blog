import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { admin } from '../../../../../db/admin';
import { UUID, dbError, json } from '../../../../../lib/posts';
import { hashKey } from '../../../../../lib/publicApi';

// Buat key baru, simpan hash-nya saja, kembalikan key asli SEKALI. Key lama langsung mati.
export const POST: APIRoute = async ({ params }) => {
  if (!UUID.test(params.id!)) return json({ error: 'ID tidak valid' }, 400);
  const key = `zk_${randomBytes(32).toString('base64url')}`;
  const { data, error } = await admin
    .from('websites')
    .update({ api_key_hash: hashKey(key) })
    .eq('id', params.id!)
    .select('id')
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return json({ error: 'Website tidak ditemukan' }, 404);
  return json({ key }, 200, { 'Cache-Control': 'no-store' });
};
