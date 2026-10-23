import type { APIRoute } from 'astro';
import { admin } from '../../../../db/admin';
import { aiFail, aiJson } from '../../../../lib/ai';
import { PLAN_SYSTEM, REVISE_SCHEMA, parseRevise, parseRevision, revisePrompt, sixMonthsAgo } from '../../../../lib/aiPlan.js';
import { wibDay } from '../../../../lib/calendar';
import { dbError, json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';

// Chat revisi untuk card hasil Generate Plan. Tidak menyimpan apa pun: dialog yang menerapkan patch ke card.
export const POST: APIRoute = async ({ request, locals }) => {
  const p = parseRevise(await request.json().catch(() => null));
  if ('error' in p) return json(p, 400);
  // ponytail: limit di memori proses (satu server Node). Pindah ke tabel ai_usage bila multi-instance.
  if (!hit(`ai:${locals.user!.id}`, 30, 3_600_000)) return json({ error: 'Too many AI requests. Try again later.' }, 429);

  const today = wibDay(new Date());
  const since = sixMonthsAgo(today);
  const ids = [...new Set(p.data.ideas.map((i) => i.website_id))];
  const [sitesQ, catsQ, plansQ, postsQ] = await Promise.all([
    admin.from('websites').select('id,name,slug').in('id', ids),
    admin.from('categories').select('id,name').order('name'),
    admin.from('content_plans').select('title').neq('status', 'rejected').gte('planned_for', since).limit(1000),
    admin.from('posts').select('title').gte('created_at', since).limit(1000),
  ]);
  const err = sitesQ.error ?? catsQ.error ?? plansQ.error ?? postsQ.error;
  if (err) return dbError(err);
  const sites = new Map((sitesQ.data ?? []).map((s) => [s.id as string, s]));
  if (ids.some((id) => !sites.has(id))) return json({ error: 'Website not found' }, 404);
  const cats = catsQ.data ?? [];
  const taken = [...(plansQ.data ?? []), ...(postsQ.data ?? [])].map((x) => x.title as string);

  try {
    const raw = await aiJson<Record<string, unknown>>(
      PLAN_SYSTEM,
      revisePrompt({
        today,
        ...p.data,
        categories: cats.map((c) => c.name),
        sites: [...sites.values()],
        ideas: p.data.ideas.map((i, k) => ({
          n: k + 1,
          site: sites.get(i.website_id)!.slug,
          title: i.title,
          date: i.planned_for,
          category: cats.find((c) => c.id === i.category_id)?.name ?? '',
          keyword: i.keyword,
          brief: i.brief,
          outline: i.outline,
        })),
      }),
      REVISE_SCHEMA,
      12288,
    );
    return json(parseRevision(raw, { ...p.data, categories: cats, taken }));
  } catch (e) {
    return aiFail(e);
  }
};
