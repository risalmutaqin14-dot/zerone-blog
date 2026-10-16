import { REVALIDATE_SECRET } from 'astro:env/server';
import { admin } from '../db/admin';

type Payload = { type: 'post' | 'category' | 'author'; slug: string; oldSlug?: string };

const send = async (url: string, p: Payload): Promise<boolean> => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': REVALIDATE_SECRET },
      body: JSON.stringify(p),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('revalidate gagal:', res.status, url, p);
    return res.ok;
  } catch (e) {
    console.error('revalidate error:', e, url, p);
    return false;
  }
};

// Webhook ke website yang disebut (post) atau semua website (category/author dipakai bersama).
// Return true kalau semua terkirim (atau tidak ada webhook). Gagal tidak boleh menggagalkan simpan di admin.
export async function revalidate(p: Payload, websiteIds?: string[]): Promise<boolean> {
  let q = admin.from('websites').select('revalidate_url').neq('revalidate_url', '');
  if (websiteIds) q = q.in('id', websiteIds);
  const { data } = await q;
  const results = await Promise.all((data ?? []).map((w) => send(w.revalidate_url, p)));
  return results.every(Boolean);
}

// Post yang sudah terbit + webhook sukses -> tandai announced_at. Kalau gagal, cron mengulang.
// Post draft/terjadwal tidak ditandai: cron yang mengirim saat waktunya tiba.
// extraSiteIds: website lama kalau post dipindah website (cache situs lama ikut dibersihkan).
export async function revalidatePost(id: string, slug: string, oldSlug?: string, extraSiteIds: string[] = []) {
  const { data: post } = await admin.from('posts').select('website_id').eq('id', id).maybeSingle();
  if (!post) return;
  const sent = await revalidate({ type: 'post', slug, oldSlug }, [...new Set([post.website_id, ...extraSiteIds])]);
  if (!sent) return;
  await admin
    .from('posts')
    .update({ announced_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString());
}

export const slugOf = async (table: 'categories' | 'authors', id: string) =>
  (await admin.from(table).select('slug').eq('id', id).maybeSingle()).data?.slug as string | undefined;
