import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { json } from '../../../../lib/posts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hapus passkey milik sendiri. Filter user_id di query = passkey user lain tidak pernah tersentuh.
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!UUID.test(params.id ?? '')) return json({ error: 'Passkey tidak ditemukan' }, 404);
  const { data, error } = await admin.from('passkeys').delete().eq('id', params.id!).eq('user_id', locals.user!.id).select('id');
  if (error) return json({ error: 'Gagal menghapus passkey' }, 500);
  if (!data?.length) return json({ error: 'Passkey tidak ditemukan' }, 404);
  return json({ ok: true });
};
