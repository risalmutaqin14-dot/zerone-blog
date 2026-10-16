import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { CRON_SECRET } from 'astro:env/server';
import { admin } from '../../../db/admin';
import { json } from '../../../lib/posts';
import { revalidatePost } from '../../../lib/revalidate';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Panggil tiap menit dari scheduler eksternal (crontab server, cron-job.org):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://admin/api/cron/publish
// Mengirim webhook untuk post terjadwal yang waktunya sudah tiba. Aman dipanggil berulang.
const run: APIRoute = async ({ request }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!CRON_SECRET || !same(token, CRON_SECRET)) return json({ error: 'Unauthorized' }, 401);

  const { data, error } = await admin
    .from('posts')
    .select('id,slug')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .is('announced_at', null)
    .limit(50);
  if (error) return json({ error: error.message }, 500);

  for (const p of data ?? []) await revalidatePost(p.id, p.slug);
  return json({ processed: data?.length ?? 0 });
};

export const POST = run;
export const GET = run;
