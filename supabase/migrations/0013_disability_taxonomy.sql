-- 0013_disability_taxonomy.sql
-- D-12 (vertical de livros) — `disability-taxonomy`, spec aprovada 2026-09-19.
--
--   1) `disability_term`  — vocabulário ÚNICO e controlado. Só admin escreve.
--                           Nunca deleta: `active=false` preserva o histórico.
--   2) `review_disability` — junção N:N resenha ↔ termo (DIS-02).
--   3) RLS + GRANTs explícitos (pós-2026-05-30: nada é auto-concedido).
--   4) Seed da LISTA-BASE PROVISÓRIA (spec §4) — a Mirian valida; trocar nomes
--      depois é UPDATE, não migration.
--   5) `create_review_with_book` / `update_review_with_book` ganham
--      `p_disability_ids uuid[] default null` NO FIM (DIS-04, atômico).
--
-- JANELA DE DEPLOY: igual à 0012 — `db push` ANTES do merge. O parâmetro novo
-- tem `default null`, e `null` significa "não mexer": o código que está no ar
-- (que não conhece o parâmetro) continua funcionando sem alteração entre o
-- push e o deploy. Corpos das funções idênticos à 0012 fora dos blocos
-- marcados "DIS-04"/"Passo 7".

-- 1) Vocabulário ----------------------------------------------------------------
create table if not exists public.disability_term (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) > 0),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active     boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- 2) Junção por vertical (livros). Filmes: `film_disability`, com a vertical.
create table if not exists public.review_disability (
  review_id uuid not null references public.review(id) on delete cascade,
  term_id   uuid not null references public.disability_term(id) on delete restrict,
  primary key (review_id, term_id)
);
create index if not exists review_disability_term_idx on public.review_disability (term_id);

alter table public.disability_term   enable row level security;
alter table public.review_disability enable row level security;

-- 3) GRANTs --------------------------------------------------------------------
grant select on table public.disability_term   to anon, authenticated;
grant insert, update on table public.disability_term to authenticated;   -- policy: só admin
grant select on table public.review_disability to anon, authenticated;
grant insert, delete on table public.review_disability to authenticated; -- policy: own-or-admin

-- RLS: disability_term ----------------------------------------------------------
-- Público vê só ATIVOS. Admin vê todos (precisa enxergar o desativado para
-- mantê-lo marcado numa resenha antiga). Sem policy de DELETE: nunca deleta.
drop policy if exists disability_term_public_read on public.disability_term;
create policy disability_term_public_read on public.disability_term
  for select to anon, authenticated
  using (active);

drop policy if exists disability_term_admin_read on public.disability_term;
create policy disability_term_admin_read on public.disability_term
  for select to authenticated
  using (public.is_admin());

drop policy if exists disability_term_admin_insert on public.disability_term;
create policy disability_term_admin_insert on public.disability_term
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists disability_term_admin_update on public.disability_term;
create policy disability_term_admin_update on public.disability_term
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- RLS: review_disability --------------------------------------------------------
-- LEITURA pública: só vínculos de resenha PUBLICADA. O subselect em `review`
-- roda sob a RLS de quem consulta — para anon, `review_public_read` já filtra
-- `published`; a condição explícita mantém a regra legível e independente.
drop policy if exists review_disability_public_read on public.review_disability;
create policy review_disability_public_read on public.review_disability
  for select to anon, authenticated
  using (exists (
    select 1 from public.review r
    where r.id = review_id and r.status = 'published'
  ));

-- LEITURA do editor: vínculos das PRÓPRIAS resenhas (qualquer status); admin: todos.
drop policy if exists review_disability_editor_read on public.review_disability;
create policy review_disability_editor_read on public.review_disability
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.review r
      where r.id = review_id
        and public.is_active_editor()
        and r.editor_id = (select auth.uid())
    )
  );

-- ESCRITA: mesma regra own-or-admin de `review_editor_update` (0008). Editor B
-- não vincula/desvincula deficiência na resenha de Editor A, mesmo publicada.
drop policy if exists review_disability_editor_insert on public.review_disability;
create policy review_disability_editor_insert on public.review_disability
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.review r
      where r.id = review_id
        and public.is_active_editor()
        and r.editor_id = (select auth.uid())
    )
  );

drop policy if exists review_disability_editor_delete on public.review_disability;
create policy review_disability_editor_delete on public.review_disability
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.review r
      where r.id = review_id
        and public.is_active_editor()
        and r.editor_id = (select auth.uid())
    )
  );

-- 4) Seed — LISTA-BASE PROVISÓRIA (spec §4). Idempotente por slug.
insert into public.disability_term (name, slug, sort_order) values
  ('Deficiência física',                          'deficiencia-fisica',         10),
  ('Deficiência visual (cegueira e baixa visão)', 'deficiencia-visual',         20),
  ('Deficiência auditiva / Surdez',               'deficiencia-auditiva-surdez',30),
  ('Surdocegueira',                               'surdocegueira',              40),
  ('Deficiência intelectual',                     'deficiencia-intelectual',    50),
  ('Transtorno do Espectro Autista (TEA)',        'tea',                        60),
  ('Deficiência psicossocial',                    'deficiencia-psicossocial',   70),
  ('Deficiência múltipla',                        'deficiencia-multipla',       80)
on conflict (slug) do nothing;

-- 5) RPCs — DROP das assinaturas da 0012 + recriação com `p_disability_ids` ----
drop function if exists public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text,
  integer, text, text, text);

drop function if exists public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, timestamptz,
  text, integer, text, text, text);

create or replace function public.create_review_with_book(
  p_book_title         text,
  p_author             text,
  p_genre_id           uuid,
  p_publisher          text,
  p_isbn               text,
  p_cover_url          text,
  p_year               smallint,
  p_publication_city   text,
  p_review_title       text,
  p_body               text,
  p_tags               text[],
  p_keywords           text[],
  p_highlight_quote    text,
  p_further_reading    jsonb,
  p_status             public.review_status,
  p_slug_base          text,
  p_pages              integer default null,
  p_original_language  text    default null,
  p_translator         text    default null,
  p_translated_from    text    default null,
  p_disability_ids     uuid[]  default null
)
returns public.review
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_book_id uuid;
  v_name    text;
  v_slug    text;
  v_review  public.review;
begin
  select e.name into v_name
  from public.editor e
  where e.id = auth.uid();

  insert into public.book
    (title, author, genre_id, publisher, isbn, cover_url, year, publication_city,
     pages, original_language, translator, translated_from)
  values
    (p_book_title, p_author, p_genre_id, p_publisher,
     p_isbn, p_cover_url, p_year, p_publication_city,
     p_pages, p_original_language, p_translator, p_translated_from)
  returning id into v_book_id;

  v_slug := public.unique_review_slug(p_slug_base);

  insert into public.review
    (book_id, title, slug, body, status, editor_id, reviewer_name,
     tags, keywords, highlight_quote, further_reading, published_at)
  values
    (v_book_id, p_review_title, v_slug, p_body, p_status, auth.uid(), v_name,
     coalesce(p_tags, '{}'),
     coalesce(p_keywords, '{}'),
     p_highlight_quote,
     coalesce(p_further_reading, '[]'::jsonb),
     case when p_status = 'published' then pg_catalog.now() else null end)
  returning * into v_review;

  -- DIS-04: deficiências na MESMA transação. `null` = nada a gravar (create
  -- nasce sem vínculos). Sob RLS (security invoker): o INSERT passa pela
  -- policy own-or-admin de `review_disability`.
  if p_disability_ids is not null then
    insert into public.review_disability (review_id, term_id)
    select v_review.id, t.id
    from (select distinct unnest(p_disability_ids) as id) t;
  end if;

  return v_review;
end $$;

revoke all on function public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text,
  integer, text, text, text, uuid[]
) from public;
grant execute on function public.create_review_with_book(
  text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, text,
  integer, text, text, text, uuid[]
) to authenticated;


-- update_review_with_book — corpo da 0012 + Passo 7 (DIS-04) -----------------
create or replace function public.update_review_with_book(
  p_review_id            uuid,
  p_book_title           text,
  p_author               text,
  p_genre_id             uuid,
  p_publisher            text,
  p_isbn                 text,
  p_cover_url            text,
  p_year                 smallint,
  p_publication_city     text,
  p_review_title         text,
  p_body                 text,
  p_tags                 text[],
  p_keywords             text[],
  p_highlight_quote      text,
  p_further_reading      jsonb,
  p_status               public.review_status,
  p_expected_updated_at  timestamptz,
  p_slug_base            text    default null,
  p_pages                integer default null,
  p_original_language    text    default null,
  p_translator           text    default null,
  p_translated_from      text    default null,
  p_disability_ids       uuid[]  default null
)
returns public.review
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_book_id             uuid;
  v_current_updated_at  timestamptz;
  v_published_at        timestamptz;
  v_current_slug        text;
  v_slug                text;
  v_review              public.review;
begin
  -- Passo 1: lê o estado atual E TRAVA A LINHA (SECURITY INVOKER, sob RLS).
  --
  -- ACHADO EMPÍRICO (verificado no banco local antes de aplicar em produção):
  -- este `select ... for update` é MAIS restritivo do que um `select` simples
  -- teria sido. A nota da 0011 sobre "ler o book_id de uma resenha publicada
  -- alheia é inofensivo" valia para o SELECT sem lock que a função tinha até a
  -- 0011 — aqui NÃO é o caso. Sob `FOR UPDATE`/`FOR SHARE`, o Postgres exige
  -- que a linha passe TAMBÉM pelo `USING` de uma policy de UPDATE aplicável,
  -- não só pelo de uma policy de SELECT — um lock de escrita implica intenção
  -- de escrever. Provado: com Editor B autenticado, uma resenha PUBLICADA de
  -- Editor A é visível a um `select` comum (via `review_public_read`), mas o
  -- MESMO `select ... for update` devolve ZERO linhas para B, porque
  -- `review_editor_update` (own-or-admin) não o autoriza. B recebe 42501 já no
  -- passo 2 (linha inexistente/fora de alcance), nunca chega ao passo 5/6. É
  -- estritamente mais seguro que o desenho original supunha — não corrigido
  -- porque não havia nada errado, só documentado aqui para quem for alterar
  -- esta função não presumir o comportamento do SELECT simples da 0011.
  --
  -- `for update`: ver a nota de P-1 no cabeçalho — sem o lock, a checagem do
  -- passo 3 seria decorativa sob concorrência.
  select r.book_id, r.updated_at, r.published_at, r.slug
    into v_book_id, v_current_updated_at, v_published_at, v_current_slug
  from public.review r
  where r.id = p_review_id
  for update;

  -- Passo 2: existência/alcance vem ANTES de qualquer outra checagem — inclusive
  -- da de conflito (passo 3). Não faz sentido perguntar "mudou desde que você
  -- abriu?" de uma linha que não existe ou nunca deveria ter sido vista.
  if v_book_id is null then
    raise exception 'Resenha inexistente ou fora do seu alcance.'
      using errcode = '42501';
  end if;

  -- Passo 3: conflito de edição concorrente (P-1). `is distinct from` trata
  -- NULL corretamente, embora `p_expected_updated_at` não tenha default e a
  -- action sempre deva enviá-lo.
  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Esta resenha foi alterada por outra pessoa desde que você abriu o formulário.'
      using errcode = '40001';
  end if;

  -- Passo 4: slug (P-2). Só regenera se (a) o chamador pediu uma base nova, (b)
  -- a resenha NUNCA foi publicada (published_at, não status — ver nota do
  -- cabeçalho) e (c) a base pedida realmente difere do slug atual (evita
  -- sufixo `-2` gratuito ao salvar sem mudar o título — a própria linha ainda
  -- ocupa `v_current_slug` nesta transação).
  if p_slug_base is not null
     and v_published_at is null
     and p_slug_base <> v_current_slug
  then
    v_slug := public.unique_review_slug(p_slug_base);
  else
    v_slug := null;
  end if;

  -- Passo 5: ficha do livro. `not found` só ocorre se `book_editor_update`
  -- negar (não é o dono, ou não é admin) — a posse é transitiva via
  -- `owns_book_via_review` (0009), não recalculada aqui.
  update public.book b set
    title              = p_book_title,
    author             = p_author,
    genre_id           = p_genre_id,
    publisher          = p_publisher,
    isbn               = p_isbn,
    cover_url          = p_cover_url,
    year               = p_year,
    publication_city   = p_publication_city,
    pages              = p_pages,
    original_language  = p_original_language,
    translator         = p_translator,
    translated_from    = p_translated_from
  where b.id = v_book_id;

  if not found then
    raise exception 'Sem permissão para editar a ficha deste livro.'
      using errcode = '42501';
  end if;

  -- Passo 6: a resenha. `slug` só muda quando o passo 4 calculou um novo (P-2);
  -- `reviewer_name`/`editor_id`/`updated_at` continuam de fora do SET (ver
  -- cabeçalho). `published_at` com o MESMO `coalesce` nos dois ramos da 0011.
  update public.review r set
    title           = p_review_title,
    slug            = coalesce(v_slug, r.slug),
    body            = p_body,
    status          = p_status,
    tags            = coalesce(p_tags, '{}'),
    keywords        = coalesce(p_keywords, '{}'),
    highlight_quote = p_highlight_quote,
    further_reading = coalesce(p_further_reading, '[]'::jsonb),
    published_at    = case
                        when p_status = 'published'
                          then coalesce(r.published_at, pg_catalog.now())
                        else r.published_at
                      end
  where r.id = p_review_id
  returning * into v_review;

  if not found then
    raise exception 'Sem permissão para editar esta resenha.'
      using errcode = '42501';
  end if;

  -- Passo 7 (DIS-04): deficiências. `null` = NÃO MEXER (chamada antiga, sem o
  -- campo); array (inclusive vazio) = substituir o conjunto. Mesma transação:
  -- falha aqui reverte ficha e resenha.
  if p_disability_ids is not null then
    delete from public.review_disability where review_id = p_review_id;
    insert into public.review_disability (review_id, term_id)
    select p_review_id, t.id
    from (select distinct unnest(p_disability_ids) as id) t;
  end if;

  return v_review;
end $$;

revoke all on function public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, timestamptz,
  text, integer, text, text, text, uuid[]
) from public;
grant execute on function public.update_review_with_book(
  uuid, text, text, uuid, text, text, text, smallint, text,
  text, text, text[], text[], text, jsonb, public.review_status, timestamptz,
  text, integer, text, text, text, uuid[]
) to authenticated;
