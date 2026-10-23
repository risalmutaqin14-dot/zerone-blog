-- Jalankan di Supabase > SQL Editor.
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  cover_url text,
  category_id uuid references categories(id) on delete restrict,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_tags_idx on posts using gin (tags);
create index if not exists posts_listing_idx on posts (status, published_at desc);
create index if not exists posts_updated_idx on posts (updated_at desc);

-- updated_at = dateModified untuk SEO: jangan naik kalau yang berubah cuma announced_at (bookkeeping cron).
create or replace function set_updated_at() returns trigger as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'announced_at' - 'search') = (to_jsonb(old) - 'updated_at' - 'announced_at' - 'search') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

-- Author + SEO (aman dijalankan ulang di DB yang sudah ada).
create table if not exists authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table posts add column if not exists author_id uuid references authors(id) on delete restrict;
alter table posts add column if not exists meta_title text not null default '';
alter table posts add column if not exists meta_description text not null default '';
alter table posts add column if not exists cover_alt text not null default '';
create index if not exists posts_author_idx on posts (author_id);

-- Profil author + deskripsi kategori (untuk SEO: JSON-LD Person, meta halaman kategori).
alter table categories add column if not exists description text not null default '';
alter table authors add column if not exists slug text;
alter table authors add column if not exists bio text not null default '';
alter table authors add column if not exists avatar_url text;
alter table authors add column if not exists links text[] not null default '{}';
update authors
  set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(id::text, 1, 4)
  where slug is null;
alter table authors alter column slug set not null;
create unique index if not exists authors_slug_key on authors (slug);

-- Redirect slug lama -> post. Diisi otomatis oleh admin saat slug post diganti.
create table if not exists slug_history (
  old_slug text primary key,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists slug_history_post_idx on slug_history (post_id);

-- Override SEO per post + dimensi cover (untuk next/image & og:image, cegah CLS).
alter table posts add column if not exists canonical_url text;
alter table posts add column if not exists og_image text;
alter table posts add column if not exists noindex boolean not null default false;
alter table posts add column if not exists cover_width int;
alter table posts add column if not exists cover_height int;

-- announced_at: kapan webhook revalidate terakhir terkirim untuk post terbit. Dipakai cron post terjadwal.
-- Backfill sekali saat kolom dibuat, supaya post lama tidak dikirim ulang semua.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'posts' and column_name = 'announced_at') then
    alter table posts add column announced_at timestamptz;
    update posts set announced_at = now() where status = 'published' and published_at <= now();
  end if;
end $$;
create index if not exists posts_unannounced_idx on posts (published_at) where announced_at is null and status = 'published';

-- Full-text search untuk GET /api/posts?q=. Config 'simple': tidak ada stemmer bahasa Indonesia bawaan.
-- Bobot: judul A, excerpt B, isi C (tag HTML dibuang). Dipakai dengan prefix match (kat:* cocok kategori).
alter table posts add column if not exists search tsvector generated always as (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('simple', regexp_replace(coalesce(content, ''), '<[^>]*>', ' ', 'g')), 'C')
) stored;
create index if not exists posts_search_idx on posts using gin (search);

-- Multi-website: satu admin, banyak situs. API key identik dengan website (disimpan sebagai hash SHA-256).
-- Category & author dipakai bersama; post milik tepat satu website.
create table if not exists websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  allowed_origin text not null default '',   -- origin CORS, pisahkan dengan koma, tanpa slash akhir
  api_key_hash text unique,                  -- null = belum ada key (API menolak). Isi lewat tombol Regenerate.
  created_at timestamptz not null default now()
);

insert into websites (name, slug, allowed_origin) values
  ('EduNav', 'edunav', 'https://edunav.id'),
  ('Latihan', 'latihan', 'https://www.latihan.id'),
  ('Zerone', 'zerone', 'https://zerone.id')
on conflict (slug) do nothing;

-- Webhook revalidate per website, mis. https://edunav.id/api/revalidate. Kosong = mati.
alter table websites add column if not exists revalidate_url text not null default '';

-- Post lama dimasukkan ke website pertama (EduNav). Ubah manual lewat edit post kalau salah.
alter table posts add column if not exists website_id uuid references websites(id) on delete restrict;
update posts set website_id = (select id from websites order by created_at, slug limit 1) where website_id is null;
alter table posts alter column website_id set not null;
create index if not exists posts_website_listing_idx on posts (website_id, status, published_at desc);

-- Slug unik per website (bukan global): dua situs boleh punya slug yang sama.
alter table posts drop constraint if exists posts_slug_key;
create unique index if not exists posts_website_slug_key on posts (website_id, slug);
-- slug_history: old_slug yang sama boleh ada di website berbeda -> PK jadi (old_slug, post_id).
alter table slug_history drop constraint if exists slug_history_pkey;
alter table slug_history add primary key (old_slug, post_id);

-- Paksa PostgREST reload cache, kalau tidak relasi baru tidak terdeteksi.
notify pgrst, 'reload schema';

-- RLS aktif tanpa policy: anon key tidak bisa baca/tulis. Hanya service role (server Astro).
alter table categories enable row level security;
alter table posts enable row level security;
alter table authors enable row level security;
alter table websites enable row level security;
alter table slug_history enable row level security;

-- Bucket gambar publik (upload hanya lewat server).
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

-- ===== Auth multi-user: author = user dashboard =====
-- Urutan deploy: (1) jalankan blok ini, (2) node --env-file=.env scripts/create-superadmin.mjs, (3) deploy kode.
-- email/password_hash boleh null (author lama tanpa login), tapi harus keduanya ada atau keduanya kosong.
alter table authors add column if not exists email text;
alter table authors add column if not exists password_hash text;
alter table authors add column if not exists role text not null default 'admin';
alter table authors add column if not exists failed_attempts int not null default 0;
alter table authors add column if not exists locked_until timestamptz;
alter table authors drop constraint if exists authors_role_check;
alter table authors add constraint authors_role_check check (role in ('superadmin', 'admin'));
alter table authors drop constraint if exists authors_login_check;
alter table authors add constraint authors_login_check check ((email is null) = (password_hash is null));
alter table authors drop constraint if exists authors_email_lower_check;
alter table authors add constraint authors_email_lower_check check (email = lower(email));
create unique index if not exists authors_email_key on authors (email);

-- Sesi server-side: token acak ada di cookie, DB hanya menyimpan hash-nya (DB bocor != sesi bocor).
-- Bisa dicabut kapan saja (logout, ganti password, hapus user -> cascade).
create table if not exists sessions (
  id text primary key,
  user_id uuid not null references authors(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);
alter table sessions enable row level security;

notify pgrst, 'reload schema';

-- Superadmin terakhir tidak boleh dihapus/diturunkan. Di DB (bukan aplikasi) supaya kebal race condition.
create or replace function guard_last_superadmin() returns trigger language plpgsql as $$
begin
  if old.role = 'superadmin' and (tg_op = 'DELETE' or new.role <> 'superadmin') then
    perform 1 from authors where role = 'superadmin' for update; -- kunci: dua permintaan paralel diserialkan
    if not exists (select 1 from authors where role = 'superadmin' and id <> old.id) then
      raise exception 'last superadmin' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists authors_guard_superadmin on authors;
create trigger authors_guard_superadmin before update of role or delete on authors
  for each row execute function guard_last_superadmin();

-- ===== Login passkey (WebAuthn): sidik jari / Face ID / PIN perangkat =====
-- Satu baris = satu passkey milik satu akun. Public key saja yang disimpan (bukan rahasia).
-- Dicabut otomatis saat akun dihapus (cascade) dan oleh aplikasi saat password diganti.
create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references authors(id) on delete cascade,
  credential_id text not null unique,                 -- base64url, dikirim perangkat saat login
  public_key text not null,                           -- base64url COSE public key
  counter bigint not null default 0,                  -- deteksi passkey yang dikloning
  transports text[] not null default '{}',
  device_type text not null default 'singleDevice',   -- singleDevice | multiDevice (tersinkron, mis. iCloud Keychain)
  backed_up boolean not null default false,
  name text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_idx on passkeys (user_id);
alter table passkeys enable row level security;   -- tanpa policy: hanya service role (server Astro)
notify pgrst, 'reload schema';
