import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { aiFail, aiJson } from '../../../../lib/ai';
import { PLAN_SCHEMA, PLAN_SYSTEM, parseGenerate, parseIdeas, planPrompt, sixMonthsAgo } from '../../../../lib/aiPlan.js';
import { wibDay } from '../../../../lib/calendar';
import { dbError, json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';

// Usulan plan dari AI. Tidak menyimpan apa pun: editor menyunting lalu menyimpan lewat POST /api/admin/plans (status idea).
export const POST: APIRoute = async ({ request, locals }) => {
  const today = wibDay(new Date());
  const p = parseGenerate(await request.json().catch(() => null), today);
  if ('error' in p) return json(p, 400);
  // ponytail: limit di memori proses (satu server Node). Pindah ke tabel ai_usage bila multi-instance.
  if (!hit(`ai:${locals.user!.id}`, 30, 3_600_000)) return json({ error: 'Too many AI requests. Try again later.' }, 429);

  const since = sixMonthsAgo(today);
  const [sitesQ, catsQ, plansQ, postsQ] = await Promise.all([
    admin.from('websites').select('id,name,slug').in('id', p.data.ids),
    admin.from('categories').select('id,name').order('name'),
    // Judul 6 bulan terakhir, semua situs (plan yang ditolak boleh dipakai ulang). Topik sama boleh, judul sama tidak.
    admin.from('content_plans').select('title,website_id').neq('status', 'rejected').gte('planned_for', since).limit(1000),
    admin.from('posts').select('title,website_id').gte('created_at', since).limit(1000),
  ]);
  const err = sitesQ.error ?? catsQ.error ?? plansQ.error ?? postsQ.error;
  if (err) return dbError(err);
  const sites = sitesQ.data ?? [];
  if (!sites.length) return json({ error: 'Website not found' }, 404);

  const all = [...(plansQ.data ?? []), ...(postsQ.data ?? [])];
  const taken = all.map((x) => x.title as string);
  const existing = (id: string) => all.filter((x) => x.website_id === id).map((x) => x.title as string).slice(0, 100);
  const withTitles = sites.map((s) => ({ ...s, existing: existing(s.id) }));
  const cats = catsQ.data ?? [];

  try {
    const raw = await aiJson<Record<string, unknown>>(
      PLAN_SYSTEM,
      planPrompt({ today, ...p.data, categories: cats.map((c) => c.name), sites: withTitles }),
      PLAN_SCHEMA,
      12288,
    );
    const ideas = parseIdeas(raw, { ...p.data, categories: cats, sites: withTitles, taken });
    return json({ ideas, empty: ideas.length === 0 });
  } catch (e) {
    return aiFail(e);
  }
};
