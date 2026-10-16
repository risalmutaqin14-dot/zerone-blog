# blog-zerone

Admin blog multi-website (EduNav, Latihan, Zerone). Astro SSR + Supabase. Dokumentasi API: `docs/API.md`, `docs/api-docs.md`.

## Deploy

Butuh Node >= 22.12.

```sh
npm ci && npm run build
HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs
```

**Jalankan satu proses saja.** Batas percobaan login per IP disimpan di memori. Dua proses = hitungan terpisah, batas jadi longgar.

### Urutan pertama kali

1. Jalankan `supabase/schema.sql` di SQL Editor Supabase.
2. Buat superadmin: `node --env-file=.env scripts/create-superadmin.mjs <email> "<Nama>"`
3. Deploy.
4. Isi API key, origin, dan URL webhook tiap website di menu Websites.

### Env

| Variabel | Fungsi |
| :-- | :-- |
| `PUBLIC_SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service role. Rahasia, jangan di-commit |
| `REVALIDATE_SECRET` | Dikirim di header `x-revalidate-secret` ke webhook tiap website. Harus sama dengan di Next.js. Kosong = webhook mati |
| `CRON_SECRET` | Bearer token untuk `/api/cron/publish`. Kosong = endpoint mati |

### Cron post terjadwal

Panggil tiap menit dari crontab server:

```
* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://admin.zerone.id/api/cron/publish
```

Setup lengkap (script, logrotate): `docs/CRON.md`. Jangan pakai GitHub Actions: jadwal tiap 5 menit menghabiskan kuota menit gratis.

### Webhook revalidate

`revalidate_url` tiap website (menu Websites) harus alamat publik situs Next.js, mis. `https://zerone.id/api/revalidate`. Route itu harus sudah ter-deploy di situs tujuan.
