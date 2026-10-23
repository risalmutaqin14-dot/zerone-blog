import type { APIRoute } from 'astro';
import { aiFail, aiJson } from '../../../../lib/ai';
import { OUTLINE_SCHEMA, SYSTEM, outlinePrompt, parseBlueprint, parseBrief } from '../../../../lib/aiArticle.js';
import { json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';
import { slugify } from '../../../../lib/slug.js';

// Tahap 1: brief -> kerangka lengkap (judul, excerpt, SEO, struktur isi). Tidak menyimpan apa pun.
export const POST: APIRoute = async ({ request, locals }) => {
  const p = parseBrief(await request.json().catch(() => null));
  if ('error' in p) return json(p, 400);
  // ponytail: limit di memori proses (satu server Node). Pindah ke tabel ai_usage bila multi-instance / perlu kuota harian.
  if (!hit(`ai:${locals.user!.id}`, 30, 3_600_000)) return json({ error: 'Too many AI requests. Try again later.' }, 429);
  try {
    const o = await aiJson<Record<string, unknown>>(SYSTEM(p.data.language), outlinePrompt(p.data), OUTLINE_SCHEMA, 12288);
    const bp = parseBlueprint(o);
    if ('error' in bp) return json({ error: 'AI returned an incomplete blueprint. Retry.' }, 502);
    return json({ ...bp.data, slug: slugify(bp.data.slug || bp.data.title) });
  } catch (e) {
    return aiFail(e);
  }
};
