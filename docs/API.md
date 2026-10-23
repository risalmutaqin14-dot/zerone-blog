# API blog-zerone

Semua respons JSON. Tiga grup:

| Grup | Prefix | Auth |
| :-- | :-- | :-- |
| Publik (dibaca Next.js) | `/api/*` | header `x-api-key: <key website>` |
| Admin | `/api/admin/*` | cookie sesi (login dulu) |
| Cron | `/api/cron/publish` | `Authorization: Bearer <CRON_SECRET>` |

## Multi-website

Satu admin melayani banyak website. Tiap website punya API key sendiri (menu **Websites**). Key menentukan website: endpoint yang sama, isi berbeda. Tidak ada parameter `?site=`.

- Post, tags, sitemap: hanya milik website pemilik key.
- Categories & authors dipakai bersama, tapi API hanya mengembalikan yang punya post terbit di website itu.
- Slug post unik per website. Slug dari website lain = `404`.
- Key disimpan sebagai hash SHA-256. Tampil sekali saat Regenerate; key lama langsung mati.
- CORS: `Access-Control-Allow-Origin` = origin request, hanya bila ada di daftar origin website. Hanya relevan untuk panggilan dari browser. Panggil dari server Next.js, simpan key di env tanpa prefix `NEXT_PUBLIC_`.

## Env

| Variabel | Fungsi |
| :-- | :-- |
| (tidak ada) | Login memakai akun di tabel `authors` (email + password scrypt). `ADMIN_PASSWORD`, `SESSION_SECRET`, `SITE_URL` sudah dihapus: boleh dibuang dari env. Superadmin pertama: `node --env-file=.env scripts/create-superadmin.mjs <email> "<Nama>"` |
| `REVALIDATE_SECRET` | Header webhook revalidate (dipakai semua website). URL webhook diatur per website di menu Websites. Kosong = mati |
| `CRON_SECRET` | Kosong = endpoint cron mati |
| `SUPABASE_SERVICE_ROLE_KEY` | Akses DB |

---

## Publik

Header wajib: `x-api-key`. Salah/kosong = `401 {"error":"Unauthorized"}`.

Cache: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` + `ETag`. Kirim `If-None-Match` untuk dapat `304`. Hanya post `published` dengan `published_at <= now` yang tampil.

### `GET /api`
Daftar endpoint publik.

### `GET /api/posts`

| Query | Default | Keterangan |
| :-- | :-- | :-- |
| `page` | 1 | |
| `limit` | 10 | 1-50 |
| `category` | | slug kategori |
| `author` | | slug author |
| `tag` | | tag (lowercase) |
| `q` | | full-text search judul/excerpt/konten. Semua kata harus cocok, prefix match (`kat` cocok `kategori`), maks 8 kata. Hasil tetap urut terbaru |

Respons:
```json
{
  "data": [{
    "id": "uuid", "title": "", "slug": "", "excerpt": "",
    "cover_url": "", "cover_alt": "", "cover_width": 1200, "cover_height": 630,
    "meta_title": "", "meta_description": "", "noindex": false,
    "tags": ["a"], "published_at": "", "updated_at": "",
    "author": { "name": "", "slug": "" },
    "category": { "name": "", "slug": "" }
  }],
  "page": 1, "limit": 10, "total": 42, "totalPages": 5
}
```

### `GET /api/posts/:slug`
Seperti item di atas, plus `content` (HTML bersih, heading punya `id`), `canonical_url`, `og_image`; `author` plus `bio`, `avatar_url`, `links`; `category` plus `description`.

- `404 {"error":"Not found"}`: tidak ada.
- `404 {"error":"Moved","redirect_to":"slug-baru"}`: slug lama. Frontend harus balas 301 ke slug baru (sengaja bukan 3xx supaya `fetch` tidak mengikuti otomatis).

### `GET /api/categories` · `GET /api/categories/:slug`
`{ name, slug, description }`. List urut nama.

### `GET /api/authors` · `GET /api/authors/:slug`
`{ name, slug, bio, avatar_url, links }`. List urut nama.

### `GET /api/tags`
`[{ "tag": "astro", "posts": 3 }]`, urut jumlah post desc lalu nama.

### `GET /api/sitemap`
```json
{ "posts": [{ "slug": "", "updated_at": "", "published_at": "", "category": { "slug": "" } }],
  "categories": ["slug"], "authors": ["slug"] }
```
Post `noindex` dikecualikan. Maks 10.000 post.

### Error
`{ "error": "pesan" }` dengan status 401 / 404 / 500.

### CORS
`OPTIONS` di semua endpoint publik balas `204`. Header yang diizinkan: `x-api-key`, `if-none-match`. Method: `GET, OPTIONS`.

---

## Admin

Wajib cookie sesi dari login. Tanpa sesi = `401 {"error":"Unauthorized"}`; role tidak berhak = `403 {"error":"Forbidden"}`. Role: `superadmin` (semua) dan `admin` (posts, categories, authors; **tidak** websites; hanya boleh mengedit profilnya sendiri). Sesi disimpan di DB (token acak, hanya hash yang tersimpan), idle 8 jam, maksimum 7 hari, dicabut saat logout / ganti password / hapus user. Request tulis lintas-origin ditolak `403`. Sukses simpan memanggil webhook revalidate (kegagalan webhook tidak menggagalkan simpan).

Error umum: `400` validasi, `404` tidak ada, `409` slug dipakai / masih dipakai data lain, `500` DB.

### Auth

| Method | Path | Body | Hasil |
| :-- | :-- | :-- | :-- |
| POST | `/api/auth/login` | form `email`, `password` | set cookie, redirect `/dashboard`; gagal = `/login?error=1` (pesan sama untuk email tak ada / password salah / akun terkunci); `/login?error=rate` bila kena rate limit. 5 salah berturut-turut = akun terkunci 15 menit |
| POST | `/api/auth/logout` | | hapus cookie, redirect `/login` |
| POST | `/api/auth/passkey/options` | | challenge login passkey (berlaku 5 menit, cookie httpOnly). Tanpa email: browser menawarkan passkey tersimpan |
| POST | `/api/auth/passkey/verify` | JSON `{response}` dari `startAuthentication()` | `{ok, redirect}` + cookie sesi; gagal = `401` pesan sama. Rate limit 20/15 menit per IP |

### Passkey (akun sendiri, semua role)

Login tanpa password memakai sidik jari / Face ID / PIN perangkat (WebAuthn, verifikasi pengguna wajib). RP ID = host `site` (astro.zerone.id). Semua passkey user dicabut saat password-nya diganti.

| Method | Path | Keterangan |
| :-- | :-- | :-- |
| GET | `/api/admin/passkeys` | Daftar passkey sendiri: `id, name, device_type, backed_up, created_at, last_used_at` |
| POST | `/api/admin/passkeys/options` | `{currentPassword}` wajib. Challenge pendaftaran untuk SATU passkey. Maks 10 passkey per akun |
| POST | `/api/admin/passkeys` | `{response, name}` dari `startRegistration()`. `201` passkey baru |
| DELETE | `/api/admin/passkeys/:id` | Hapus passkey sendiri |

### Posts

| Method | Path | Keterangan |
| :-- | :-- | :-- |
| GET | `/api/admin/posts` | List. Query: `page`, `limit` (1-100, default 30), `q` (judul), `status` (`draft`/`published`/`scheduled`), `category` (uuid). Respons `{data,page,limit,total,totalPages}` |
| POST | `/api/admin/posts` | Buat. `201 {id}` |
| GET | `/api/admin/posts/:id` | Detail (semua status) |
| PUT | `/api/admin/posts/:id` | Ubah. Slug berubah = slug lama masuk `slug_history` |
| DELETE | `/api/admin/posts/:id` | Hapus |

Body POST/PUT:

| Field | Aturan |
| :-- | :-- |
| `title` | wajib, maks 200 |
| `slug` | opsional, default dari title |
| `excerpt` | maks 500 |
| `content` | HTML, disanitasi |
| `cover_url`, `canonical_url`, `og_image` | harus `http(s)://` |
| `cover_alt` | maks 200 |
| `cover_width`, `cover_height` | angka 1-20000, dipakai bila keduanya valid |
| `meta_title` | maks 70 |
| `meta_description` | maks 160 |
| `noindex` | boolean |
| `category_id`, `author_id` | uuid atau null |
| `tags` | array, unik, lowercase, maks 10 |
| `status` | `draft` (default) / `published` |
| `published_at` | ISO. Masa depan = terjadwal. Default sekarang |

### Categories

| Method | Path | Body |
| :-- | :-- | :-- |
| GET | `/api/admin/categories` | |
| POST | `/api/admin/categories` | `{name, slug?, description?}` (nama maks 60, deskripsi maks 300) |
| GET | `/api/admin/categories/:id` | |
| PUT | `/api/admin/categories/:id` | sama dengan POST |
| DELETE | `/api/admin/categories/:id` | `409` bila dipakai post |

### Authors

| Method | Path | Body |
| :-- | :-- | :-- |
| GET | `/api/admin/authors` | |
| POST | `/api/admin/authors` | **superadmin saja.** `{name, email, password (12-128), role? (default admin), current_password, slug?, bio?, avatar_url?, links?}`. `current_password` = password pelaku. `409` email dipakai |
| GET | `/api/admin/authors/:id` | |
| PUT | `/api/admin/authors/:id` | Diri sendiri atau superadmin (selain itu `403`). Ubah `email`/`password`/`role` wajib `current_password`; `role` hanya superadmin. `password` kosong = tidak diganti. Sesi lain user itu dicabut |
| DELETE | `/api/admin/authors/:id` | superadmin saja. `409` bila dipakai post, akun sendiri, atau superadmin terakhir |

`name` maks 80, `bio` maks 500, `links` array URL atau string satu-URL-per-baris (maks 10, `http(s)://`).

### Upload

`POST /api/admin/upload`, `multipart/form-data`, field `file`.
JPG/PNG/WEBP/GIF, maks 5 MB, harus gambar valid.
Respons: `{ "url": "...", "width": 1200, "height": 630 }`.

---

## Cron

`GET` atau `POST /api/cron/publish` dengan `Authorization: Bearer <CRON_SECRET>`.
Kirim webhook revalidate untuk post terjadwal yang waktunya tiba dan belum diumumkan (maks 50 per panggilan). Aman dipanggil berulang. Jadwalkan tiap menit.

```sh
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://astro.zerone.id/api/cron/publish
# {"processed":2}
```

## Webhook revalidate (keluar)

`POST <revalidate_url website>`, header `x-revalidate-secret: <REVALIDATE_SECRET>`, timeout 5 detik.
```json
{ "type": "post" | "category" | "author", "slug": "baru", "oldSlug": "lama (opsional)" }
```

## Contoh

```sh
curl -H "x-api-key: $KEY" "https://astro.zerone.id/api/posts?category=berita&author=budi&page=2"
curl -H "x-api-key: $KEY" https://astro.zerone.id/api/posts/judul-post
```
