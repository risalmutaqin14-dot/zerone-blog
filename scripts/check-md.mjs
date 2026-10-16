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

// Tanpa frontmatter: body utuh.
assert.equal(splitFrontmatter('halo').body, 'halo');
console.log('md ok');
