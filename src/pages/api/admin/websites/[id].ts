import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { UUID, dbError, json } from '../../../../lib/posts';
import { slugify } from '../../../../lib/slug.js';
import { isHttp } from '../../../../lib/taxonomy';

// Tidak ada tambah/hapus website: jumlahnya tetap. Hanya edit.
export const PUT: APIRoute = async ({ request, params }) => {
  if (!UUID.test(params.id!)) return json({ error: 'ID tidak valid' }, 400);
  const b: any = await request.json().catch(() => null);

  const name = String(b?.name ?? '').trim().slice(0, 60);
  const slug = slugify(b?.slug || name);
  if (!name || !slug) return json({ error: 'Nama wajib diisi' }, 400);

  // Origin = scheme + host (+port), tanpa path/slash akhir. new URL().origin menormalkan.
  const origins: string[] = [];
  for (const raw of String(b?.allowed_origin ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    let o = '';
    try { o = isHttp(raw) ? new URL(raw).origin : ''; } catch { /* tidak valid */ }
    if (!o) return json({ error: `Origin tidak valid: ${raw}` }, 400);
    origins.push(o);
  }

  const revalidate_url = String(b?.revalidate_url ?? '').trim().slice(0, 300);
  if (revalidate_url && !isHttp(revalidate_url)) return json({ error: 'URL revalidate harus diawali http(s)://' }, 400);

  const { data, error } = await admin
    .from('websites')
    .update({ name, slug, allowed_origin: [...new Set(origins)].join(','), revalidate_url })
    .eq('id', params.id!)
    .select('id')
    .maybeSingle();
  if (error) return dbError(error);
  return data ? json({ ok: true }) : json({ error: 'Website tidak ditemukan' }, 404);
};
