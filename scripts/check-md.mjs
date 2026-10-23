import assert from 'node:assert/strict';
import { mdToHtml, splitFrontmatter } from '../src/lib/markdown.js';

const src = `---
title: "Judul Dari FM"
description: Ringkasan singkat
---
# Heading Satu
## Dua
Teks **tebal** dan [link](https://a.id).

![ok](https://a.id/x.png)
![lokal](./x.png)

> kutipan

| A | B |
|---|---|
| 1 | 2 |

###### Enam
`;

assert.deepEqual(splitFrontmatter(src).meta, { title: 'Judul Dari FM', description: 'Ringkasan singkat' });

const r = mdToHtml(src);
assert.equal(r.title, 'Judul Dari FM');
assert.equal(r.description, 'Ringkasan singkat');
assert.equal(r.localImages, 1);
assert.ok(!r.html.includes('<h1'), 'h1 harus turun jadi h2');
assert.ok(r.html.includes('<h2>Heading Satu</h2>'));
assert.ok(r.html.includes('<h4>Enam</h4>'));
assert.ok(r.html.includes('<strong>tebal</strong>'));
assert.ok(r.html.includes('<blockquote>'));
assert.ok(r.html.includes('<table>') && r.html.includes('<th>A</th>'));

// takeTitle: tanpa frontmatter, H1 jadi judul dan dibuang dari isi.
const t = mdToHtml('# Judul H1\n\nIsi', { takeTitle: true });
assert.equal(t.title, 'Judul H1');
assert.ok(!t.html.includes('Judul H1'));

// Frontmatter lengkap: kunci "meta-title" dan "meta_title" sama; tags list/CSV.
const full = mdToHtml(`---
title: T
slug: slug-satu
excerpt: Ringkas
meta_title: MT
meta-description: MD
tags: [SEO, "#Blog", seo]
---
Isi`);
assert.equal(full.slug, 'slug-satu');
assert.equal(full.excerpt, 'Ringkas');
assert.equal(full.meta_title, 'MT');
assert.equal(full.meta_description, 'MD');
assert.deepEqual(full.tags, ['seo', 'blog']);
// excerpt jatuh ke description bila tidak ada.
assert.equal(mdToHtml('---\ndescription: D\n---\nx').excerpt, 'D');

// Tanpa frontmatter: body utuh.
assert.equal(splitFrontmatter('halo').body, 'halo');
console.log('md ok');
