# PRD — Kalender & AI Content Studio (v0.2, disesuaikan dengan kode)

Perubahan dari draft 0.1: nama kolom mengikuti skema CMS, status `posts` tidak diperluas, role hanya `admin`/`superadmin`, worker publikasi memakai `/api/cron/publish` yang sudah ada.

## 1. Ringkasan
Ruang kerja konten: **rencana → draft → jadwal → terbit**. Kalender menampilkan plan dan artikel terjadwal per website (EduNav, Latihan, Zerone). AI membantu membuat plan dan draft artikel. AI tidak pernah menerbitkan; manusia mengontrol topik, isi, dan jadwal.

## 2. Keputusan
| Topik | Keputusan |
|---|---|
| Brand | = `websites` (`website_id`), bukan tabel baru |
| Role | `admin` dan `superadmin` sama-sama boleh menyetujui dan menjadwalkan. Role writer/reviewer ditunda |
| Status post | Tetap `draft`/`published`. "Scheduled" = `published` + `published_at` di masa depan |
| Status plan | `idea` → `planned` → `drafted`, plus `rejected` |
| Plan | Bisa manual atau AI (kolom `source`). Plan AI selalu masuk sebagai `idea` |
| Dua tanggal | `content_plans.planned_for` (tanggal rencana) terpisah dari `posts.published_at` (jadwal terbit). Memindah yang satu tidak mengubah yang lain |
| Zona waktu | Tampilan WIB (`Asia/Jakarta`), data timestamp UTC |
| Publikasi | Pakai `/api/cron/publish` + `posts.announced_at` (idempoten). Tanpa `publication_jobs` |
| Format isi AI | Markdown → `marked` → `cleanHtml`. HTML dari AI tidak dipercaya |
| Penyedia AI | Satu penyedia, lewat `fetch` dari server di `src/lib/ai.ts`. Mulai Gemini; uji 3 brief nyata di Gemini dan Claude sebelum fase 3, pilih yang lebih baik |
| Revisi per bagian | Ditunda. MVP hanya tombol "generate ulang" |
| Riset web | Di luar MVP. Sumber = teks yang ditempel pengguna |
| Profil brand/template | Ditunda. MVP: tone dan aturan brand ditulis di kolom brief |

## 3. Data
- `content_plans`: `id`, `website_id`, `title`, `keyword`, `brief`, `outline`, `category_id`, `planned_for`, `status`, `source` (`manual`|`ai`), `created_by`, `created_at`, `updated_at`.
- `posts.content_plan_id` (nullable) menghubungkan draft ke plan.
- Fase AI: `ai_usage` (`user_id`, `kind`, `model_id`, `created_at`) untuk kuota harian di DB. Rate limit memori tidak cukup karena AI berbiaya nyata.

## 4. Fase
1. **Kalender + plan manual** (selesai): `/dashboard/calendar`, bulan, filter website, tambah/edit/hapus plan lewat popup, post terjadwal/terbit tampil di tanggalnya.
2. **AI plan**: `POST /api/admin/plans/generate`. Input: website, kategori, tujuan, audiens, periode, jumlah ide. Output JSON ber-schema, divalidasi ulang di server, disimpan sebagai `idea`. Kartu bisa diedit/diterima/ditolak.
3. **AI artikel**: `POST /api/admin/plans/:id/article`. Membuat post `draft` (`content_plan_id` terisi), plan jadi `drafted`, lalu buka editor yang ada. Field: `title`, `slug`, `excerpt`, `meta_title`, `meta_description`, `content`. `claims_to_verify` ditampilkan sebagai peringatan, tidak masuk `content`.
4. **Jadwal**: admin memakai editor yang ada (`status=published` + `published_at` masa depan). Cron yang ada menerbitkan.

## 5. Keamanan AI
- API key hanya di env server (`astro:env/server`, secret). Tidak pernah ke browser.
- Kuota per user per hari (DB), batas ukuran input/output, timeout.
- AI tidak punya akses DB atau publikasi. Backend memvalidasi semua output sebelum menyimpan.
- Simpan `model_id` dan versi prompt. Jangan simpan rahasia di log.
- JSON valid tidak menjamin fakta benar; editor wajib memeriksa.

## 6. Ukuran keberhasilan
Persentase plan AI yang dipakai, persentase draft AI yang akhirnya terbit, waktu plan → terbit, kelengkapan field SEO sebelum terbit. Untuk dampak SEO/lead, ukur klik organik dan konversi per artikel setelah Analytics/GSC tersedia.

## 7. Belum diputuskan
Nama model dan batas kuota harian. Cek daftar model di dokumentasi resmi penyedia saat fase 2 dimulai.
