// Helper murni AI plan generator (tanpa import Astro, dites di scripts/check-aiplan.mjs).
// Alur: pilih website + rentang tanggal -> AI mengusulkan ide -> editor menyunting -> disimpan lewat POST /api/admin/plans.

import { SECTIONS_FORMAT } from './aiArticle.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const isDay = (d) => DAY.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const span = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000;

// Profil editorial per slug website (arahan editorial, bukan bukti fitur produk). Slug lain -> profil umum.
export const PROFILES = {
  zerone:
    'Readers: business owners, institution leaders, operations/product/IT decision makers. Focus: custom web apps, CMS, UI/UX, API/integration, data migration, digital solutions. Cover decisions and implementation needs, NOT general tech news.',
  latihan:
    'Readers: exam committees, teachers who build assessments, academic coordinators, testing institutions. Focus: CBT, exam operations, question banks, assessment, exam integrity, result evaluation. Never promise to prevent all cheating.',
  edunav:
    'Readers: school principals, administrative staff/operators, academic admins, foundations. Focus: school administration, academic operations, student data, reporting, operational coordination/communication. NOT general study tips and NOT technical CBT (that belongs to Latihan).',
};

// Aturan judul: natural, hook hanya kadang, tanpa simbol kecuali benar-benar perlu. Dipakai plan + revisi.
const TITLE_RULE =
  '"title": a natural Indonesian headline, the way a human editor would write it. Max 60 characters. Most titles should be plain and descriptive with NO hook; use a hook (a concrete number, a pain point, a clear benefit) in at most 1 of every 3 titles, and only when it really fits. Write the hook in words, never with symbols. NEVER use "?", ":", "!", dashes as separators, quotes, brackets or emoji; use a symbol only when the title truly cannot be written without it. Do NOT phrase titles as questions. No ALL CAPS, no empty clickbait, no guarantees of results.';

// Jaring pengaman bila AI tetap memakai simbol: buang ? ! dan emoji-ish, ubah titik dua / tanda pisah jadi koma.
const plainTitle = (t) =>
  t
    .replace(/[?!？！]+/g, '')
    .replace(/\s*[:：]\s*/g, ', ')
    .replace(/\s+[-–—]\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '');

/** Batas awal jendela 6 bulan untuk cek judul kembar. @param {string} today YYYY-MM-DD */
export const sixMonthsAgo = (today) => {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 6);
  return d.toISOString().slice(0, 10);
};

/** @param {any} b @param {string} today YYYY-MM-DD (WIB) */
export function parseGenerate(b, today) {
  const ids = [...new Set(Array.isArray(b?.website_ids) ? b.website_ids.map(String) : [])].filter((x) => UUID.test(x)).slice(0, 5);
  if (!ids.length) return { error: 'Pick at least one website' };
  const from = clean(b?.from, 10) || today;
  const to = clean(b?.to, 10) || addDays(from, 13);
  if (!isDay(from) || !isDay(to)) return { error: 'Invalid date range' };
  if (from < today) return { error: 'Start date is in the past' };
  if (to < from) return { error: 'End date is before start date' };
  if (span(from, to) > 30) return { error: 'Date range must be at most 31 days' };
  const perSite = Math.min(3, Math.max(1, Math.round(Number(b?.per_site)) || 2));
  return { data: { ids, from, to, perSite, theme: clean(b?.theme, 300) } };
}

/**
 * @param {{ today: string, from: string, to: string, perSite: number, theme: string, categories: string[],
 *   sites: { slug: string, name: string, existing: string[] }[] }} c
 */
export function planPrompt(c) {
  const sites = c.sites
    .map(
      (s) =>
        `- slug "${s.slug}" (${s.name}). ${PROFILES[s.slug] ?? 'General company blog.'}\n  Titles used in the last 6 months (never reuse or lightly reword a title; the same topic may return only with a clearly new title and angle):\n${s.existing.length ? s.existing.map((t) => `    * ${t}`).join('\n') : '    (none)'}`,
    )
    .join('\n');
  return `Today is ${c.today} (Asia/Jakarta). Propose blog article plans for Indonesian websites, to be published between ${c.from} and ${c.to}.

Websites:
${sites}

Rules:
- At most ${c.perSite} ideas per website. Fewer is fine; return nothing for a website if no topic is strong. Never pad with weak topics.
- Topics must fit the site's readers. Different sites must use a different persona, problem and angle, even on a shared theme.
- You have NO live news access. Base ideas on recurring Indonesian seasons and issues that reliably fit the date (academic calendar, exam periods, report cards, budget/admin deadlines, school enrolment, digital transformation cycles) or on evergreen problems. Never claim something is "trending now" or state a regulation, number, date or statistic as fact. Put anything an editor must check in "verify".
- "date" must be inside ${c.from}..${c.to}, format YYYY-MM-DD.
- "category" must be one of: ${c.categories.length ? c.categories.join(', ') : '(none, use empty string)'}.
- "keyword": one main keyword, Indonesian, max 6 words. Do not invent search volume.
- "brief": a developed writing brief, 6-9 sentences (about 700-1200 characters), in plain paragraphs. Cover in order: who the reader is and their situation; the concrete problem they face; the angle that makes this article different from generic content; the key points or questions the article must answer (3-5); the practical takeaway or next step for the reader; why this timing fits; the tone. Be specific to this website's readers, not generic.
- ${TITLE_RULE}
- "outline" (optional article structure for the editor): ${SECTIONS_FORMAT}
${c.theme ? `- Editor theme/pillar to favour: ${c.theme}\n` : ''}Write everything in Indonesian.`;
}

/** Skema petunjuk untuk aiJson (ai.ts membaca key, type, dan desc). */
export const PLAN_SCHEMA = {
  properties: {
    ideas: {
      type: 'ARRAY',
      desc: 'array of objects {"site": slug, "title": string, "date": "YYYY-MM-DD", "category": string, "keyword": string, "brief": string, "outline": string, "verify": string}; [] if nothing is strong enough',
    },
  },
};

/**
 * Validasi + bersihkan output AI. Buang: situs asing, judul kosong/duplikat (vs existing & batch), melebihi kuota per situs.
 * @param {any} raw
 * @param {{ from: string, to: string, perSite: number, categories: { id: string, name: string }[],
 *   taken: string[], sites: { id: string, slug: string }[] }} c
 */
export function parseIdeas(raw, c) {
  const bySlug = new Map(c.sites.map((s) => [s.slug, s]));
  const seen = new Set(c.taken.map(norm)); // semua judul 6 bulan terakhir, lintas situs
  const count = new Map();
  const out = [];
  for (const i of Array.isArray(raw?.ideas) ? raw.ideas : []) {
    const site = bySlug.get(String(i?.site ?? '').trim());
    const title = plainTitle(clean(i?.title, 200));
    const key = norm(title);
    if (!site || !key || seen.has(key) || (count.get(site.slug) ?? 0) >= c.perSite) continue;
    seen.add(key);
    count.set(site.slug, (count.get(site.slug) ?? 0) + 1);
    const d = clean(i?.date, 10);
    const cat = c.categories.find((x) => norm(x.name) === norm(i?.category ?? ''));
    const verify = clean(i?.verify, 300);
    out.push({
      website_id: site.id,
      title,
      planned_for: isDay(d) && d >= c.from && d <= c.to ? d : c.from, // di luar rentang -> awal rentang
      status: 'idea',
      category_id: cat?.id ?? '',
      keyword: clean(i?.keyword, 100),
      brief: clean(clean(i?.brief, 1600) + (verify ? `\n\nPerlu verifikasi: ${verify}` : ''), 2000),
      outline: clean(i?.outline, 5000),
    });
  }
  return out;
}

// ===== Chat revisi: editor minta perbaikan, AI mengembalikan HANYA card yang berubah =====
export const PLAN_SYSTEM =
  'You are a senior content strategist for Indonesian B2B/education websites. Never invent facts, statistics, regulations, dates, URLs, or search metrics. Be honest when a topic is weak: return fewer ideas.';

/** @param {any} b */
export function parseRevise(b) {
  const message = clean(b?.message, 1000);
  if (!message) return { error: 'Write what to change' };
  const from = clean(b?.from, 10);
  const to = clean(b?.to, 10);
  if (!isDay(from) || !isDay(to) || to < from) return { error: 'Invalid date range' };
  const list = Array.isArray(b?.ideas) ? b.ideas.slice(0, 15) : [];
  if (!list.length) return { error: 'No plans to revise' };
  const ideas = [];
  for (const i of list) {
    if (!UUID.test(String(i?.website_id ?? ''))) return { error: 'Invalid website' };
    ideas.push({
      website_id: i.website_id,
      title: clean(i.title, 200),
      planned_for: clean(i.planned_for, 10),
      category_id: UUID.test(String(i.category_id ?? '')) ? i.category_id : '',
      keyword: clean(i.keyword, 100),
      brief: clean(i.brief, 2000),
      outline: clean(i.outline, 5000),
    });
  }
  const history = (Array.isArray(b?.history) ? b.history : [])
    .slice(-6)
    .map((h) => ({ role: h?.role === 'ai' ? 'ai' : 'user', text: clean(h?.text, 500) }))
    .filter((h) => h.text);
  return { data: { message, from, to, ideas, history } };
}

export const REVISE_SCHEMA = {
  properties: {
    reply: { type: 'STRING', desc: 'string, 1-2 short sentences to the editor' },
    changes: {
      type: 'ARRAY',
      desc: 'array of objects {"n": number, plus ONLY the changed fields among "title", "date" (YYYY-MM-DD), "category", "keyword", "brief", "outline"}; [] if nothing changes',
    },
  },
};

/**
 * @param {{ today: string, from: string, to: string, message: string, history: { role: string, text: string }[], categories: string[],
 *   sites: { slug: string, name: string }[], ideas: { n: number, site: string, title: string, date: string, category: string, keyword: string, brief: string, outline: string }[] }} c
 */
export function revisePrompt(c) {
  const sites = c.sites.map((s) => `- ${s.slug} (${s.name}): ${PROFILES[s.slug] ?? 'General company blog.'}`).join('\n');
  const chat = c.history.length ? `Earlier in this chat:\n${c.history.map((h) => `${h.role === 'ai' ? 'Assistant' : 'Editor'}: ${h.text}`).join('\n')}\n\n` : '';
  return `Today is ${c.today} (Asia/Jakarta). You are refining blog plans you proposed, together with an editor. Plans are numbered "n", the same as the cards on screen.

Websites:
${sites}

Current plans (the editor may have edited them by hand; these are the truth), one JSON per line:
${c.ideas.map((i) => JSON.stringify(i)).join('\n')}

${chat}Editor says: ${c.message}

Rules:
- Change only what the editor asks. Return ONLY the plans you change: "n" plus only the changed fields. If nothing needs changing (e.g. a question), return "changes": [] and answer in "reply".
- ${TITLE_RULE}
- "date" must be inside ${c.from}..${c.to}, format YYYY-MM-DD.
- "category" must be one of: ${c.categories.length ? c.categories.join(', ') : '(none, use empty string)'}.
- Each plan must fit its own site's readers. Different sites keep a different persona, problem and angle.
- Never state a regulation, number, date or statistic as fact. Anything to check goes at the end of "brief" as "Perlu verifikasi: ...".
- "outline" (only when asked): ${SECTIONS_FORMAT}
- "reply": 1-2 short sentences, in the language the editor writes in, saying what you changed.`;
}

/**
 * Validasi usulan revisi. Hanya field valid yang masuk patch; judul bentrok (6 bulan / card lain) ditolak dan dilaporkan.
 * @param {any} raw
 * @param {{ from: string, to: string, categories: { id: string, name: string }[], taken: string[], ideas: { title: string }[] }} c
 */
export function parseRevision(raw, c) {
  const taken = new Set(c.taken.map(norm));
  const titles = c.ideas.map((i) => i.title);
  const done = new Set();
  const changes = [];
  const rejected = [];
  for (const ch of Array.isArray(raw?.changes) ? raw.changes : []) {
    const idx = Math.round(Number(ch?.n)) - 1;
    if (!c.ideas[idx] || done.has(idx)) continue;
    done.add(idx);
    const patch = {};
    const title = plainTitle(clean(ch.title, 200));
    if (title) {
      const k = norm(title);
      const clash = k !== norm(titles[idx]) && (taken.has(k) || titles.some((t, j) => j !== idx && norm(t) === k));
      if (clash) rejected.push(idx + 1);
      else patch.title = titles[idx] = title;
    }
    const d = clean(ch.date, 10);
    if (isDay(d) && d >= c.from && d <= c.to) patch.planned_for = d;
    if (typeof ch.category === 'string') {
      const cat = c.categories.find((x) => norm(x.name) === norm(ch.category));
      if (cat) patch.category_id = cat.id;
      else if (!ch.category.trim()) patch.category_id = '';
    }
    for (const [k, max] of [['keyword', 100], ['brief', 2000], ['outline', 5000]]) {
      const v = clean(ch[k], max);
      if (v) patch[k] = v;
    }
    if (Object.keys(patch).length) changes.push({ n: idx + 1, patch });
  }
  return { reply: clean(raw?.reply, 600) || (changes.length ? 'Done.' : 'No changes.'), changes, rejected };
}

