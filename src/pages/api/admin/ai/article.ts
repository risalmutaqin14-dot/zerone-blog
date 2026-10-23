import type { APIRoute } from 'astro';
import { AiError, aiFail, aiText } from '../../../../lib/ai';
import { SYSTEM, articlePrompt, checkArticle, parseArticleText, parseBlueprint, parseBrief, referencesMd } from '../../../../lib/aiArticle.js';
import { mdToHtml } from '../../../../lib/markdown.js';
import { cleanHtml, json } from '../../../../lib/posts';
import { hit } from '../../../../lib/rateLimit';
import { slugify } from '../../../../lib/slug.js';

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Tahap 2: brief + kerangka yang sudah disetujui -> artikel final. Tidak menyimpan apa pun:
// hasil dikembalikan ke browser, editor yang menerapkan lalu menyimpan sebagai Draft.
export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const p = parseBrief(body);
  if ('error' in p) return json(p, 400);
  const bp = parseBlueprint(body?.blueprint);
  if ('error' in bp) return json(bp, 400);
  if (!hit(`ai:${locals.user!.id}`, 30, 3_600_000)) return json({ error: 'Too many AI requests. Try again later.' }, 429);
  try {
    const a = parseArticleText(await aiText(SYSTEM(p.data.language), articlePrompt(p.data, bp.data), 32768));
    // Markdown dari AI tidak dipercaya: marked -> sanitize-html.
    const body_ = cleanHtml(mdToHtml(String(a.content_markdown ?? '')).html);
    if (!body_.trim()) throw new AiError('AI returned an empty article. Retry.');
    // Referensi dari sumber editor ditambahkan setelah checklist dihitung, supaya tidak menggeser jumlah kata/H2.
    const content = cleanHtml(mdToHtml(String(a.content_markdown ?? '') + referencesMd(p.data)).html);
    const b = bp.data;
    return json({
      title: b.title,
      slug: slugify(b.slug || b.title),
      excerpt: b.excerpt,
      meta_title: b.meta_title,
      meta_description: b.meta_description,
      tags: [...new Set((Array.isArray(a.tags) ? a.tags : []).map((t: unknown) => str(t, 40).toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 5),
      content,
      claims_to_verify: (Array.isArray(a.claims_to_verify) ? a.claims_to_verify : []).map((c: unknown) => str(c, 300)).filter(Boolean).slice(0, 10),
      checks: checkArticle(b, body_, p.data),
    });
  } catch (e) {
    return aiFail(e);
  }
};
