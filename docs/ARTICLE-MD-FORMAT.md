# Format File Markdown Artikel

Dipakai tombol **Import .md** di halaman Create/Edit Post. Satu file = satu artikel. Frontmatter mengisi judul, slug, excerpt, SEO, tags. Isi file menjadi isi artikel.

## Aturan Import

- Ekstensi `.md` / `.markdown`, maks 1 MB.
- Frontmatter hanya mengisi field yang **masih kosong** (tidak menimpa input manual). Tags digabung dengan tag yang sudah ada.
- Kunci `meta-title` dan `meta_title` dianggap sama (huruf besar/kecil diabaikan).

## Template

```markdown
---
title: "Judul Artikel Maksimal 200 Karakter"
slug: judul-artikel-huruf-kecil-pakai-dash
excerpt: "Ringkasan 1-2 kalimat untuk kartu/list artikel. Maks 500 karakter."
meta_title: "Judul SEO, maks 70 karakter"
meta_description: "Deskripsi SEO yang mengandung keyword utama dan ajakan klik. Maks 160 karakter."
tags: [keyword utama, keyword turunan, topik]
---

Paragraf pembuka berisi keyword utama dalam 1-2 kalimat pertama. Langsung ke inti.

## Heading Section Pertama

Paragraf pendek. Satu ide per paragraf.

### Sub-heading

- Poin satu
- Poin dua

1. Langkah satu
2. Langkah dua

| Kolom A | Kolom B |
|---------|---------|
| Data 1  | Data 2  |

> Kutipan atau catatan penting.

## FAQ

### Pertanyaan pertama?

Jawaban singkat.

### Pertanyaan kedua?

Jawaban singkat.

## Kesimpulan

Ringkas poin utama dan satu ajakan bertindak.

## Referensi

- [Nama Sumber](https://contoh.com/halaman)
```

## Field Frontmatter

| Field | Wajib | Batas | Keterangan |
|-------|-------|-------|------------|
| `title` | ya | 200 | Judul artikel. Jika kosong, `# H1` pertama di isi dipakai sebagai judul lalu dibuang dari isi. |
| `slug` | tidak | - | Huruf kecil, angka, dash. Kosong = dibuat dari judul. |
| `excerpt` | tidak | 500 | Kosong = pakai `description`. |
| `description` | tidak | 500 | Alias `excerpt` (kompatibel format lama). |
| `meta_title` | tidak | 70 | Kosong = form pakai judul. |
| `meta_description` | tidak | 160 | Kosong = form pakai excerpt. |
| `tags` | tidak | 10 tag | Satu baris: `[a, b, c]` atau `a, b, c`. Otomatis huruf kecil, tanpa `#`, tanpa duplikat. |

## Batasan Format

- Frontmatter diawali dan diakhiri `---` sendiri di satu baris. Mulai dari baris pertama file.
- Tiap field **satu baris**: `key: value`. Tidak ada list multi-baris (`- item`), tidak ada nilai multi-baris.
- Beri tanda kutip pada value yang berisi `"`, `#`, atau diawali karakter khusus.
- Jangan tulis `# H1` di isi bila `title` sudah ada. Editor hanya mendukung H2-H4: `#` otomatis jadi H2, `#####`/`######` jadi H4. Pakai `##` dan `###`.
- Gambar: hanya URL absolut `https://...`. Path lokal (`./a.png`) tidak tampil dan perlu diganti manual.
- Hindari HTML mentah; sisi server menyaring tag yang tidak didukung. Pakai sintaks Markdown.
- Yang didukung: heading H2-H4, paragraf, **bold**, *italic*, link, list bullet/angka, tabel (GFM), blockquote, kode, gambar.

---

## Prompt untuk AI Lain (salin-tempel)

```text
Tulis satu artikel blog dalam format file Markdown (.md) yang siap di-import ke CMS. Keluarkan HANYA isi file, tanpa penjelasan dan tanpa membungkus dengan code fence.

TOPIK: {topik}
KEYWORD UTAMA: {keyword utama}
KEYWORD TURUNAN: {keyword 1, keyword 2, ...}
BAHASA: {Indonesia / English}
NADA: {mis. santai-profesional}
TARGET PEMBACA: {siapa}
PANJANG: {mis. 1200 kata}
SUMBER/FAKTA YANG BOLEH DIPAKAI: {tempel data; jangan mengarang angka, nama, atau kutipan}

STRUKTUR FILE (ikuti persis):

1. Baris pertama `---`, lalu frontmatter, lalu `---`. Setiap field SATU baris `key: "value"`:
   - title: maks 200 karakter, memuat keyword utama
   - slug: huruf kecil, angka, dash; tanpa stop word berlebih
   - excerpt: 1-2 kalimat, maks 500 karakter
   - meta_title: maks 70 karakter, memuat keyword utama
   - meta_description: maks 160 karakter, memuat keyword utama + ajakan klik
   - tags: satu baris format [tag1, tag2, tag3], 3-8 tag, huruf kecil, tanpa #
   Jangan pakai list YAML multi-baris.

2. Setelah frontmatter, tulis isi artikel dalam Markdown:
   - JANGAN tulis `# H1` (judul sudah di frontmatter). Pakai `##` untuk section dan `###` untuk sub-section. Jangan pakai H4 ke bawah kecuali perlu.
   - Paragraf pembuka memuat keyword utama di 1-2 kalimat pertama.
   - Kalimat pendek, paragraf pendek (maks 3-4 kalimat).
   - Gunakan list dan tabel Markdown (GFM) bila membantu. Tanpa HTML mentah.
   - Gambar hanya bila ada URL https absolut; jika tidak ada, jangan sisipkan gambar.
   - Sertakan section `## FAQ` dengan format `### Pertanyaan?` diikuti jawaban singkat.
   - Akhiri dengan `## Kesimpulan`.
   - Sertakan `## Referensi` (list link `[Nama](https://...)`) HANYA bila ada sumber nyata dari saya. Jangan membuat URL.

LARANGAN: mengarang fakta/statistik/kutipan, keyword stuffing, emoji dekoratif, kalimat klise pembuka ("Di era digital ini...").
```
