// Helper murni AI article generator: parse input, prompt, schema, checklist.
// Tanpa import Astro supaya bisa dites di node (scripts/check-ai.mjs).
// Alur: brief -> kerangka lengkap (judul, excerpt, SEO, struktur isi) -> review/edit -> artikel final.

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @typedef {{ keyword: string, brief: string, related: string[], sources: string[], language: string, tone: string, minWords: number }} Brief
 * @typedef {{ title: string, slug: string, excerpt: string, meta_title: string, meta_description: string, sections: string }} Blueprint
 * @param {any} b
 * @returns {{ error: string } | { data: Brief }}
 */
export function parseBrief(b) {
  const keyword = clean(b?.keyword, 120);
  const brief = clean(b?.brief, 4000);
  if (!keyword) return { error: 'Main keyword is required' };
  if (!brief) return { error: 'Brief is required' };
  const related = (Array.isArray(b.related) ? b.related : []).map((x) => clean(x, 80)).filter(Boolean).slice(0, 10);
  // Satu sumber per baris (URL web/blog, jurnal, Google Scholar, dll). Bullet/nomor di awal dibuang.
  const sources = String(b?.sources ?? '')
    .split(/\r?\n/)
    .map((s) => clean(s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''), 400))
    .filter(Boolean)
    .slice(0, 20);
  return {
    data: {
      keyword,
      brief,
      related,
      sources,
      language: b.language === 'en' ? 'English' : 'Indonesian',
      tone: clean(b.tone, 100),
      minWords: Math.min(3000, Math.max(300, Math.round(Number(b.minWords)) || 800)),
    },
  };
}

/** @param {any} b */
export function parseBlueprint(b) {
  const o = {
    title: clean(b?.title, 200),
    slug: clean(b?.slug, 120),
    excerpt: clean(b?.excerpt, 500),
    meta_title: clean(b?.meta_title, 70),
    meta_description: clean(b?.meta_description, 160),
    sections: clean(b?.sections, 8000),
  };
  if (!o.title) return { error: 'Title is required' };
  if (!o.sections) return { error: 'Article structure is required' };
  return { data: /** @type {Blueprint} */ (o) };
}

export const SYSTEM = (/** @type {string} */ language) =>
  `You are a senior SEO content writer for a company blog. Write in ${language}.
Never invent facts, statistics, quotes, prices, dates, market data, URLs, or source names. If a fact is needed and neither the brief nor the provided sources supply it, stay general and list it in claims_to_verify.
Never write an image or a link; the editor adds them. Never write a references/bibliography section; the system appends it.`;

/** @param {Brief} d */
const context = (d) =>
  `Main keyword: ${d.keyword}
Related keywords: ${d.related.join(', ') || '(none)'}
Tone: ${d.tone || 'professional, clear'}
Target length: at least ${d.minWords} words
Brief:
${d.brief}
Sources provided by the editor (you cannot open them; rely only on what the brief says about them):
${d.sources.map((s) => `- ${s}`).join('\n') || '(none)'}`;

// Format struktur artikel. Dipakai bersama oleh outline artikel dan outline plan (aiPlan.js) supaya skenarionya identik.
export const SECTIONS_FORMAT = `the article structure in Markdown, in reading order. Format:
  "## Heading" for each H2, optional "### Subheading", and under each heading 2-4 lines starting with "- " describing what the paragraphs will cover.
  Include as needed: an introduction (no heading needed beyond the first H2), 4+ H2 sections with the main keyword in at least one, a "Table:" line inside a section when a comparison fits (name the columns and rows), a "Bullets: item; item; item" line when the content is a set of parallel points, features, or tips, a "Numbered: step; step; step" line when the content is an ordered sequence such as steps, a process, or a ranking (use Bullets/Numbered only where a list reads better than a paragraph; never for every section; each item is a short phrase naming what it covers, 3-8 items), a FAQ section ("## FAQ" then "- Q: question" lines, 3-5 questions) and a conclusion. Do NOT include a References section; the system adds it from the editor's sources.`;

/** @param {Brief} d */
export const outlinePrompt = (d) =>
  `Plan a complete article blueprint (not the article itself).
${context(d)}

Return:
- title: max 60 characters, contains the main keyword.
- slug: lowercase, hyphenated.
- excerpt: 1-2 sentences, max 300 characters.
- meta_title: max 60 characters. meta_description: 120-160 characters, contains the main keyword.
- sections: ${SECTIONS_FORMAT}
  REQUIRED: at least one "## " (H2) heading must contain the main keyword "${d.keyword}" exactly, word for word, in natural wording. A variant, synonym or reordered words does not count.`;

export const OUTLINE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    slug: { type: 'STRING' },
    excerpt: { type: 'STRING' },
    meta_title: { type: 'STRING' },
    meta_description: { type: 'STRING' },
    sections: { type: 'STRING' },
  },
  required: ['title', 'slug', 'excerpt', 'meta_title', 'meta_description', 'sections'],
};

// ===== Chat revisi outline: editor minta perbaikan, AI mengembalikan HANYA field yang berubah =====
const BP_FIELDS = /** @type {const} */ ([['title', 200], ['slug', 120], ['excerpt', 500], ['meta_title', 70], ['meta_description', 160], ['sections', 8000]]);

/** Validasi request chat: brief + blueprint saat ini (kebenaran, mungkin sudah disunting editor) + pesan + riwayat.
 * @param {any} b
 * @returns {{ error: string } | { data: { brief: Brief, blueprint: Blueprint, message: string, history: { role: string, text: string }[] } }}
 */
export function parseOutlineRevise(b) {
  const message = clean(b?.message, 1000);
  if (!message) return { error: 'Write what to change' };
  const d = parseBrief(b);
  if ('error' in d) return d;
  const bp = parseBlueprint(b?.blueprint);
  if ('error' in bp) return bp;
  const history = (Array.isArray(b?.history) ? b.history : [])
    .slice(-6)
    .map((h) => ({ role: h?.role === 'ai' ? 'ai' : 'user', text: clean(h?.text, 500) }))
    .filter((h) => h.text);
  return { data: { brief: d.data, blueprint: bp.data, message, history } };
}

/**
 * @param {Brief} d
 * @param {Blueprint} bp
 * @param {string} message
 * @param {{ role: string, text: string }[]} history
 */
export const reviseOutlinePrompt = (d, bp, message, history) =>
  `You are refining an article blueprint together with an editor. The blueprint below is the truth (the editor may have edited it by hand).
${context(d)}

Current blueprint (JSON):
${JSON.stringify(bp)}

${history.length ? `Earlier in this chat:\n${history.map((h) => `${h.role === 'ai' ? 'Assistant' : 'Editor'}: ${h.text}`).join('\n')}\n\n` : ''}Editor says: ${message}

Rules:
- Change only what the editor asks. In "changes" return ONLY the changed fields, each with its full new value (for "sections" return the whole structure). If nothing needs changing (e.g. a question), return "changes": {} and answer in "reply".
- Keep: title max 60 characters containing the main keyword; meta_title max 60; meta_description 120-160 characters containing the main keyword; excerpt max 300; slug lowercase hyphenated.
- "sections": ${SECTIONS_FORMAT}
- Keep at least one "## " (H2) heading containing the main keyword "${d.keyword}" exactly, word for word, after your change.
- Never state a statistic, price, date or regulation as fact.
- "reply": 1-2 short sentences, in the language the editor writes in, saying what you changed.`;

export const OUTLINE_REVISE_SCHEMA = {
  properties: {
    reply: { type: 'STRING', desc: 'string, 1-2 short sentences to the editor' },
    changes: {
      type: 'OBJECT',
      desc: 'object with ONLY the changed fields among "title", "slug", "excerpt", "meta_title", "meta_description", "sections"; {} if nothing changes',
    },
  },
};

/** Ambil hanya field valid dari jawaban AI (dipotong sesuai batas form). @param {any} raw */
export function parseOutlinePatch(raw) {
  const ch = raw?.changes && typeof raw.changes === 'object' ? raw.changes : {};
  /** @type {Partial<Blueprint>} */
  const patch = {};
  for (const [k, max] of BP_FIELDS) {
    const v = clean(ch[k], max);
    if (v) patch[k] = v;
  }
  return { reply: clean(raw?.reply, 600) || (Object.keys(patch).length ? 'Done.' : 'No changes.'), patch };
}

/**
 * @param {Brief} d
 * @param {Blueprint} bp
 */
export const articlePrompt = (d, bp) =>
  `Write the full article body from the APPROVED blueprint. Follow its sections exactly: same headings, same order. Do not add or drop sections.
${context(d)}

Title: ${bp.title}
Excerpt: ${bp.excerpt}
APPROVED structure:
${bp.sections}

Rules:
- content_markdown: Markdown, no H1. Start with the opening paragraph containing the main keyword, then the sections with ## and ###. Use every related keyword naturally. Short sentences, short paragraphs.
- At least one "##" heading must contain the main keyword "${d.keyword}" exactly, word for word. If none of the approved headings does, add the keyword into the wording of the most relevant H2 heading (the only allowed change to the headings). The opening paragraph must also contain it exactly.
- Where the structure says "Table:", write a Markdown table. Where it says "Bullets:", write a Markdown bullet list ("- item") with one line per listed item, each expanded into a short informative sentence. Where it says "Numbered:", write a Markdown numbered list ("1. item") in the same order. Put one short lead-in sentence before each list. Do not turn other parts into lists. Write the FAQ as "### question" followed by a short answer paragraph.
- Do NOT write a References section; the system appends it. Do not write URLs or source names in the body.
- tags: 3-5 short lowercase tags.
- claims_to_verify: facts, numbers, or claims the editor must check before publishing (empty if none).

Output format: plain text, NOT JSON. Use exactly these three marker lines, each alone on its line, in this order:
===TAGS===
tag one, tag two, tag three
===CLAIMS===
- one claim per line (write "none" if there are none)
===MARKDOWN===
the full article in Markdown (content_markdown)`;

/**
 * Parse keluaran teks ber-penanda dari AI. Toleran: tanpa penanda sama sekali, seluruh teks dianggap artikel.
 * @param {string} raw
 * @returns {{ content_markdown: string, tags: string[], claims_to_verify: string[] }}
 */
export function parseArticleText(raw) {
  const s = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  const pick = (/** @type {string} */ name) => s.match(new RegExp(`===${name}===[ \\t]*\\n([\\s\\S]*?)(?=\\n===[A-Z_]+===|$)`))?.[1]?.trim() ?? '';
  const unfence = (/** @type {string} */ t) => t.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '').trim();
  const content_markdown = unfence(pick('MARKDOWN') || (/===[A-Z_]+===/.test(s) ? '' : s));
  const tags = pick('TAGS').split(/[,\n]/).map((t) => t.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  const claims_to_verify = pick('CLAIMS')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter((l) => l && !/^\(?none\)?\.?$/i.test(l));
  return { content_markdown, tags, claims_to_verify };
}

/**
 * Daftar referensi dari sumber yang diisi editor, bukan dari AI. Kosong = tanpa section.
 * URL telanjang di-link otomatis oleh marked (gfm).
 * @param {Brief} d
 */
export const referencesMd = (d) =>
  d.sources.length ? `\n\n## ${d.language === 'English' ? 'References' : 'Referensi'}\n\n${d.sources.map((s) => `- ${s}`).join('\n')}\n` : '';

export const ARTICLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    content_markdown: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    claims_to_verify: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['content_markdown', 'tags', 'claims_to_verify'],
};

/**
 * Checklist dihitung dari konten yang benar-benar dihasilkan, bukan klaim AI.
 * Tidak mencakup: gambar, internal/external link, panjang kalimat (butuh aset/katalog dari CMS).
 * @param {{ title: string, meta_description: string }} bp kerangka yang disetujui
 * @param {string} html body hasil sanitasi
 * @param {Brief} d
 */
export function checkArticle(bp, html, d) {
  const body = text(html);
  const words = body ? body.split(' ').length : 0;
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => norm(text(m[1])));
  const firstP = norm(text(html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''));
  const kw = norm(d.keyword);
  const lowBody = norm(body);
  const missing = d.related.filter((r) => !lowBody.includes(norm(r)));
  const metaLen = bp.meta_description.trim().length;
  const titleLen = bp.title.trim().length;
  const yn = (b) => (b ? 'yes' : 'no');
  const row = (id, label, ok, actual, target) => ({ id, label, ok, actual, target });
  return [
    row('title-len', 'Title length', titleLen > 0 && titleLen <= 60, titleLen, '≤ 60'),
    row('title-kw', 'Keyword in title', norm(bp.title).includes(kw), yn(norm(bp.title).includes(kw)), 'yes'),
    row('meta-len', 'Meta description length', metaLen >= 120 && metaLen <= 160, metaLen, '120–160'),
    row('words', 'Body words', words >= d.minWords, words, `≥ ${d.minWords}`),
    row('first-p', 'Keyword in first paragraph', firstP.includes(kw), yn(firstP.includes(kw)), 'yes'),
    row('h2-count', 'H2 sections', h2.length >= 3, h2.length, '≥ 3'),
    row('h2-kw', 'Keyword in an H2', h2.some((h) => h.includes(kw)), yn(h2.some((h) => h.includes(kw))), 'yes'),
    ...(d.related.length ? [row('related', 'Related keywords used', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all', 'all')] : []),
  ];
}

