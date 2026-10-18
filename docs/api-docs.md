# Dokumentasi API

API publik read-only untuk menyajikan blog/artikel ke website utama (Next.js). Admin hanya mengelola konten.

## Mulai

Base URL: URL deploy admin, mis. `https://astro.zerone.id`. Semua path di bawah relatif terhadap base URL.

```sh
curl -H "x-api-key: <API_KEY_WEBSITE>" https://astro.zerone.id/api/posts
```

> **Panggil dari server.** Jangan taruh API key di kode browser atau variabel `NEXT_PUBLIC_*`. Pakai Server Component, route handler, atau `generateStaticParams`.

## Multi-website

Satu admin melayani banyak website (mis. edunav.id, latihan.id, zerone.id). Tiap website punya API key sendiri, dibuat di dashboard menu **Websites**. Key menentukan website: endpoint sama, isi berbeda. Tidak ada parameter `?site=`.

- `/api/posts`, `/api/tags`, `/api/sitemap`: hanya milik website pemilik key.
- Kategori dan author dipakai bersama, tapi API hanya mengembalikan yang punya post terbit di website itu.
- Slug post unik per website. Slug milik website lain = `404`. `redirect_to` hanya untuk slug lama di website yang sama.
- Key disimpan sebagai hash dan tampil sekali saat dibuat. Regenerate mematikan key lama seketika.

## Autentikasi

Semua endpoint publik butuh header:

```
x-api-key: <API_KEY_WEBSITE>
```

Key salah, kosong, atau website belum punya key = `401 {"error":"Unauthorized"}`.

CORS hanya relevan jika browser memanggil API langsung. `Access-Control-Allow-Origin` diisi origin request, hanya bila terdaftar di website pemilik key (diatur di menu Websites, pisahkan koma bila lebih dari satu, mis. dengan dan tanpa `www`). Respons memakai `Vary: Origin, x-api-key`. Metode: `GET`, `OPTIONS`.

## Respons & error

| Status | Arti |
| :-- | :-- |
| `200` | Sukses, body JSON. |
| `304` | `If-None-Match` cocok dengan ETag. Tanpa body. |
| `401` | `x-api-key` salah. |
| `404` | `{"error":"Not found"}`, atau `{"error":"Moved","redirect_to":"slug-baru"}` untuk slug lama post. |
| `500` | `{"error":"pesan"}`, kesalahan database. |

Post hanya muncul jika `status = published` dan `published_at` sudah lewat. Draft dan post terjadwal tidak pernah keluar.

## Cache & ETag

Setiap respons 200 membawa:

```
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
ETag: "<hash>"
```

Kirim `If-None-Match: <ETag>` untuk mendapat `304`. Cache pendek hanya jaring pengaman; penyegaran utama lewat [webhook revalidate](#webhook-revalidate).

## Daftar post

`GET /api/posts`

Daftar post terbit, terbaru dulu. Tidak berisi `content`.

| Query | Default | Keterangan |
| :-- | :-- | :-- |
| `page` | 1 | Halaman, mulai 1. |
| `limit` | 10 | 1-50. |
| `category` | - | Slug kategori. |
| `author` | - | Slug author. |
| `tag` | - | Satu tag (huruf kecil). |
| `q` | - | Cari di judul, excerpt, konten. Semua kata harus cocok, prefix match, maks 8 kata dan 100 karakter. |

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Judul",
      "slug": "judul",
      "excerpt": "Ringkasan",
      "cover_url": "https://.../cover.webp",
      "cover_alt": "Teks alternatif",
      "cover_width": 1200,
      "cover_height": 630,
      "meta_title": "Judul SEO",
      "meta_description": "Deskripsi SEO",
      "noindex": false,
      "tags": ["astro", "react"],
      "published_at": "2026-01-01T08:00:00+00:00",
      "updated_at": "2026-01-02T09:00:00+00:00",
      "author": { "name": "Budi", "slug": "budi" },
      "category": { "name": "Tutorial", "slug": "tutorial" }
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5
}
```

`author` dan `category` bisa `null`. `noindex: true` = sembunyikan dari listing/related di frontend jika perlu.

## Detail post

`GET /api/posts/:slug`

```json
{
  "id": "uuid",
  "title": "Judul",
  "slug": "judul",
  "excerpt": "Ringkasan",
  "content": "<h2 id=\"bagian\">...</h2><p>...</p>",
  "cover_url": "https://.../cover.webp",
  "cover_alt": "Teks alternatif",
  "cover_width": 1200,
  "cover_height": 630,
  "meta_title": "Judul SEO",
  "meta_description": "Deskripsi SEO",
  "canonical_url": null,
  "og_image": null,
  "noindex": false,
  "tags": ["astro"],
  "published_at": "2026-01-01T08:00:00+00:00",
  "updated_at": "2026-01-02T09:00:00+00:00",
  "author": {
    "name": "Budi", "slug": "budi", "bio": "...",
    "avatar_url": "https://.../budi.webp",
    "links": ["https://x.com/budi"]
  },
  "category": { "name": "Tutorial", "slug": "tutorial", "description": "..." }
}
```

### Catatan konten

- `content` adalah HTML yang sudah disanitasi. Heading punya atribut `id` (untuk daftar isi). `<img>` punya `width`/`height` (cegah layout shift).
- Link eksternal sudah ber-`rel="nofollow"`; link ke host `allowed_origin` website si post tidak.
- Fallback SEO di frontend: `meta_title ?? title`, `meta_description ?? excerpt`, `og_image ?? cover_url`, `canonical_url ?? URL post`.

### Slug lama

Jika slug pernah diubah, request ke slug lama membalas:

```
404
{ "error": "Moved", "redirect_to": "slug-baru" }
```

Dibuat bukan 3xx supaya `fetch` tidak mengikutinya otomatis. Frontend yang memutuskan `301` (`permanentRedirect`).

## Kategori

`GET /api/categories` dan `GET /api/categories/:slug`

```json
[{ "name": "Tutorial", "slug": "tutorial", "description": "Panduan langkah demi langkah" }]
```

Detail membalas satu objek, atau `404 Not found`.

## Author

`GET /api/authors` dan `GET /api/authors/:slug`

```json
[{
  "name": "Budi Santoso",
  "slug": "budi-santoso",
  "bio": "Penulis...",
  "avatar_url": "https://.../budi.webp",
  "links": ["https://x.com/budi", "https://github.com/budi"]
}]
```

Daftar post per author/kategori: pakai `/api/posts?author=slug` atau `/api/posts?category=slug`.

## Tag

`GET /api/tags`

Diurutkan dari paling banyak dipakai. Hanya menghitung post terbit.

```json
[{ "tag": "astro", "posts": 12 }, { "tag": "react", "posts": 7 }]
```

## Sitemap

`GET /api/sitemap`

Data ringan untuk `sitemap.ts` di Next.js. Post `noindex` sudah disaring. Maks 10.000 post.

```json
{
  "posts": [
    { "slug": "judul", "updated_at": "...", "published_at": "...", "category": { "slug": "tutorial" } }
  ],
  "categories": ["tutorial"],
  "authors": ["budi-santoso"]
}
```

Pakai endpoint ini untuk sitemap, jangan menyusun ulang dari `/api/posts`, supaya filter `noindex` tidak terlewat.

## Webhook revalidate

Admin memanggil Next.js saat konten berubah, agar cache segar tanpa menunggu. URL webhook diatur per website (menu Websites). Post dikirim ke website-nya saja (dan website lama bila post dipindah). Perubahan kategori/author dikirim ke semua website yang punya URL.

```
POST {revalidate_url website}
Content-Type: application/json
x-revalidate-secret: {REVALIDATE_SECRET}

{ "type": "post" | "category" | "author", "slug": "judul", "oldSlug": "judul-lama" }
```

| Field | Keterangan |
| :-- | :-- |
| `type` | Jenis konten yang berubah. |
| `slug` | Slug saat ini. |
| `oldSlug` | Opsional. Ada jika slug diubah, revalidate juga slug lama. |

Next.js wajib memvalidasi header secret, lalu balas `2xx`. Non-2xx atau timeout (5 detik) dicatat di log admin, tidak menggagalkan simpan. Untuk post terbit, kegagalan diulang oleh cron.

## Cron publish terjadwal

`POST /api/cron/publish` (`GET` juga diterima)

Mengirim webhook untuk post terjadwal yang waktunya sudah tiba. Aman dipanggil berulang (maks 50 post per panggilan).

```sh
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://astro.zerone.id/api/cron/publish
```

```
200 { "processed": 2 }
401 { "error": "Unauthorized" }   // secret salah, atau CRON_SECRET kosong (endpoint mati)
```

Jadwalkan tiap menit lewat cron-job.org atau crontab. Contoh crontab server: `* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://astro.zerone.id/api/cron/publish`. Jangan pakai GitHub Actions (jadwal tiap 5 menit menghabiskan kuota menit gratis).

## Contoh Next.js

### Client: `lib/api.ts`

```ts
const BASE = process.env.ADMIN_API_URL!;
const KEY = process.env.ADMIN_API_KEY!;

export async function api<T>(path: string, tags: string[] = []): Promise<{ ok: true; data: T } | { ok: false; status: number; redirectTo?: string }> {
  const res = await fetch(BASE + path, {
    headers: { 'x-api-key': KEY },
    next: { tags, revalidate: 3600 },
  });
  if (res.ok) return { ok: true, data: await res.json() };
  const body = await res.json().catch(() => ({}));
  return { ok: false, status: res.status, redirectTo: body.redirect_to };
}
```

### Halaman detail: `app/blog/[slug]/page.tsx`

```tsx
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';

async function getPost(slug: string) {
  const r = await api<any>(`/api/posts/${slug}`, ['posts', `post:${slug}`]);
  if (r.ok) return r.data;
  if (r.redirectTo) permanentRedirect(`/blog/${r.redirectTo}`);
  notFound();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPost((await params).slug);
  return {
    title: p.meta_title ?? p.title,
    description: p.meta_description ?? p.excerpt,
    alternates: { canonical: p.canonical_url ?? `/blog/${p.slug}` },
    robots: p.noindex ? { index: false, follow: true } : undefined,
    openGraph: { images: [p.og_image ?? p.cover_url].filter(Boolean) },
  };
}
```

### Sitemap: `app/sitemap.ts`

```ts
import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const r = await api<any>('/api/sitemap', ['posts']);
  if (!r.ok) return [];
  const base = process.env.NEXT_PUBLIC_SITE_URL!;
  return r.data.posts.map((p: any) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.updated_at ?? p.published_at,
  }));
}
```

### Webhook: `app/api/revalidate/route.ts`

```ts
import { revalidateTag } from 'next/cache';

export async function POST(req: Request) {
  if (req.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, slug, oldSlug } = await req.json();
  revalidateTag('posts');
  for (const s of [slug, oldSlug].filter(Boolean)) revalidateTag(`${type}:${s}`);
  return Response.json({ revalidated: true });
}
```

> Di Next.js 16, `revalidateTag` butuh argumen kedua (profil cache), mis. `revalidateTag('posts', 'max')`. Sesuaikan dengan versi yang dipakai.

### Dikerjakan di sisi Next.js

Related posts, prev/next, `reading_time`, daftar isi (dari `id` heading), JSON-LD (`Article`, `BreadcrumbList`), `generateMetadata`, `sitemap.ts`, `robots.ts`.

## Environment

| Admin (.env) | Fungsi |
| :-- | :-- |
| `REVALIDATE_SECRET` | Dikirim di header `x-revalidate-secret`. Dipakai bersama semua website. Kosong = webhook mati. |
| `CRON_SECRET` | Bearer token untuk `/api/cron/publish`. Kosong = endpoint mati. |

| Next.js (.env) | Isi |
| :-- | :-- |
| `ADMIN_API_URL` | Base URL admin, tanpa slash di akhir. |
| `ADMIN_API_KEY` | API key website ini (menu Websites di admin). Tiap Next.js punya key sendiri. |
| `REVALIDATE_SECRET` | Sama dengan admin. |
| `NEXT_PUBLIC_SITE_URL` | URL web utama. |
