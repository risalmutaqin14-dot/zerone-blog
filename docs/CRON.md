# Cron server: publish post terjadwal

Dijalankan di server Linux, bukan di repo. Panggil `/api/cron/publish` tiap menit.

> **Produksi (Axiom, astro.zerone.id) sudah terpasang:** crontab user `zerone` menjalankan `/var/www/html/zerone-blog/shared/cron-publish.sh` tiap menit, langsung ke `http://127.0.0.1:3004/api/cron/publish`; log hanya error/yang diproses di `~/logs/zerone-blog-cron.log`. Jangan pasang langkah di bawah lagi di Axiom (endpoint jadi dipanggil dua kali). Panduan di bawah untuk server lain.

## 1. Simpan secret (permission 600)

```sh
sudo sh -c 'echo "CRON_SECRET=isi_secret_produksi" > /etc/default/publish'
sudo chmod 600 /etc/default/publish
```

Nilainya harus sama dengan `CRON_SECRET` di env admin.

## 2. Script `/usr/local/bin/publish.sh`

```sh
#!/bin/sh
. /etc/default/publish
curl -fsS -m 30 -X POST "https://astro.zerone.id/api/cron/publish" \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-publish.log 2>&1
echo >> /var/log/cron-publish.log
```

```sh
sudo chmod 755 /usr/local/bin/publish.sh
sudo /usr/local/bin/publish.sh && tail -n 3 /var/log/cron-publish.log   # tes: {"processed":0}
```

## 3. Crontab (`sudo crontab -e`)

```
* * * * * /usr/local/bin/publish.sh
```

Cron tidak membaca `.env`, jadi secret diambil dari `/etc/default/publish` oleh script.

## 4. Rotasi log `/etc/logrotate.d/cron-publish`

```
/var/log/cron-publish.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
```

## Cek masalah

| Log | Arti |
| :-- | :-- |
| `{"processed":0}` | Normal, tidak ada yang tertunda |
| `{"processed":N}` terus-menerus | Webhook gagal. Cek `revalidate_url` dan `REVALIDATE_SECRET` |
| `401` / `curl: (22) ... 401` | `CRON_SECRET` salah atau kosong di env admin |
| `curl: (7)` / timeout | Admin tidak terjangkau |

Kalau secret pernah bocor (commit, chat), ganti `CRON_SECRET` di env admin dan di `/etc/default/publish`, lalu restart admin.
