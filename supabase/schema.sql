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

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

-- RLS aktif tanpa policy: anon key tidak bisa baca/tulis. Hanya service role (server Astro).
alter table categories enable row level security;
alter table posts enable row level security;

-- Bucket gambar publik (upload hanya lewat server).
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;
