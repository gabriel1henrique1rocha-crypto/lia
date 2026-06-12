-- 0002_book_data_hardening.sql
-- Endurece a tabela `book` (idempotente, DO-guards no padrão do 0001):
--   - genre_id NOT NULL (gênero obrigatório — BOOK-04)
--   - CHECK pages > 0 (BOOK-03)
--   - CHECK year entre 1 e 2100 — sanidade (BOOK-03/10)
--   - CHECK translator ⇒ translated_from (BOOK-10)
-- A regra "ano não futuro" e o checksum de ISBN ficam na app (zod), pois não
-- são expressáveis como CHECK imutável (DD-3).

-- genre_id NOT NULL (só aplica se ainda for nullable → reaplicação segura)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'book' and column_name = 'genre_id' and is_nullable = 'YES'
  ) then
    alter table book alter column genre_id set not null;
  end if;
end $$;

-- CHECK pages > 0
alter table book drop constraint if exists book_pages_positive;
alter table book add  constraint book_pages_positive check (pages is null or pages > 0);

-- CHECK year sane (1..2100)
alter table book drop constraint if exists book_year_sane;
alter table book add  constraint book_year_sane check (year is null or year between 1 and 2100);

-- CHECK translator ⇒ translated_from
alter table book drop constraint if exists book_translation_consistent;
alter table book add  constraint book_translation_consistent
  check (translator is null or translated_from is not null);
