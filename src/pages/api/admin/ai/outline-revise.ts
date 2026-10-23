import type { APIRoute } from 'astro';
import { aiFail, aiJson } from '../../../../lib/ai';
import { OUTLINE_REVISE_SCHEMA, SYSTEM, parseOutlinePatch, parseOutlineRevise, reviseOutlinePrompt } from '../../../../lib/aiArticle.js';
import { json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';
import { slugify } from '../../../../lib/slug.js';

// Chat revisi untuk tahap Review outline. Tidak menyimpan apa pun: dialog yang menerapkan patch ke form.
export const POST: APIRoute = async ({ request, locals }) => {
  const p = parseOutlineRevise(await request.json().catch(() => null));
  if ('error' in p) return json(p, 400);
  // ponytail: limit di memori proses (satu server Node). Pindah ke tabel ai_usage bila multi-instance.
  if (!hit(`ai:${locals.user!.id}`, 30, 3_600_000)) return json({ error: 'Too many AI requests. Try again later.' }, 429);
  const { brief, blueprint, message, history } = p.data;
  try {
    const raw = await aiJson<Record<string, unknown>>(SYSTEM(brief.language), reviseOutlinePrompt(brief, blueprint, message, history), OUTLINE_REVISE_SCHEMA, 12288);
    const out = parseOutlinePatch(raw);
    if (out.patch.slug) out.patch.slug = slugify(out.patch.slug);
    return json(out);
  } catch (e) {
    return aiFail(e);
  }
};
