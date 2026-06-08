-- 1) enums (criação guardada → reaplicação segura)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type review_status as enum ('draft', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'comment_status') then
    create type comment_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'editor_role') then
    create type editor_role as enum ('admin', 'editor');
  end if;
end $$;

-- 2) genre (genre 1—N book)
create table if not exists genre (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- 3) book
create table if not exists book (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  author            text not null,
  genre_id          uuid references genre(id) on delete restrict,
  publisher         text,
  isbn              text,
  cover_url         text,
  year              smallint,
  pages             integer,
  original_language text,
  translator        text,
  translated_from   text,
  created_at        timestamptz not null default now()
);
create index if not exists book_genre_id_idx on book(genre_id);

-- 4) editor (perfil ligado a auth.users)
create table if not exists editor (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  name       text not null,
  role       editor_role not null default 'editor',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5) review (review 1—1 book via UNIQUE book_id; editor 1—N review)
create table if not exists review (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null unique references book(id) on delete cascade,
  title        text not null,
  slug         text not null unique,
  rating       numeric(2,1) check (rating >= 0 and rating <= 5),
  body         text,
  status       review_status not null default 'draft',
  editor_id    uuid references editor(id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists review_status_idx    on review(status);
create index if not exists review_editor_id_idx on review(editor_id);

-- updated_at automático
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists review_set_updated_at on review;
create trigger review_set_updated_at before update on review
  for each row execute function set_updated_at();

-- 6) comment (review 1—N comment)
create table if not exists comment (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references review(id) on delete cascade,
  author_name text,
  body        text not null,
  status      comment_status not null default 'pending',
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists comment_review_status_idx on comment(review_id, status);

-- 7) recommendation (1 voto por visitante → unique(review_id, voter_hash))
create table if not exists recommendation (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references review(id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  unique (review_id, voter_hash)
);
create index if not exists recommendation_review_id_idx on recommendation(review_id);

-- 8) RLS habilitado, deny-by-default (políticas por papel → M2)
alter table genre          enable row level security;
alter table book           enable row level security;
alter table editor         enable row level security;
alter table review         enable row level security;
alter table comment        enable row level security;
alter table recommendation enable row level security;
