import { marked } from 'marked';

export const MD_MAX_BYTES = 1024 * 1024;

const unquote = (v) => v.trim().replace(/^(['"])(.*)\1$/, '$2');

// Frontmatter sederhana: baris "key: value" di antara dua '---'. Bukan parser YAML penuh.
// ponytail: nilai multi-baris / list tidak didukung; pakai yaml parser bila perlu.
export function splitFrontmatter(src) {
  const m = src.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/);
    if (kv) meta[kv[1].toLowerCase().replace(/-/g, '_')] = unquote(kv[2]);
  }
  return { meta, body: src.slice(m[0].length) };
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

// "[a, b]" atau "a, b" -> ['a','b'] (lowercase, tanpa '#', unik, maks 10 sesuai batas form).
const parseTags = (v = '') =>
  [...new Set(v.replace(/^\[|\]$/g, '').split(',').map((t) => unquote(t).toLowerCase().replace(/^#/, '').trim()).filter(Boolean))].slice(0, 10);

// Editor hanya punya H2-H4: h1 -> h2, h5/h6 -> h4.
const shiftHeadings = (html) =>
  html
    .replace(/<(\/?)h1(?=[\s>])/g, '<$1h2')
    .replace(/<(\/?)h[56](?=[\s>])/g, '<$1h4');

/**
 * @param {string} src isi file .md
 * @param {{ takeTitle?: boolean }} [opt] takeTitle: H1 pertama dipakai sebagai judul & dibuang dari isi
 * @returns {{ html: string, title: string, description: string, localImages: number }}
 */
export function mdToHtml(src, { takeTitle = false } = {}) {
  const { meta, body } = splitFrontmatter(src);
  let html = /** @type {string} */ (marked.parse(body, { gfm: true, async: false }));

  let title = meta.title ?? '';
  if (takeTitle && !title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>\s*/);
    if (h1) {
      title = stripTags(h1[1]);
      html = html.replace(h1[0], '');
    }
  }

  const localImages = [...html.matchAll(/<img[^>]+src="([^"]*)"/g)].filter((m) => !/^(https?:)?\/\//i.test(m[1])).length;
  const description = meta.description ?? '';
  return {
    html: shiftHeadings(html),
    title,
    slug: meta.slug ?? '',
    excerpt: meta.excerpt ?? description,
    description,
    meta_title: meta.meta_title ?? '',
    meta_description: meta.meta_description ?? '',
    tags: parseTags(meta.tags),
    localImages,
  };
}
