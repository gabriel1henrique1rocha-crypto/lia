-- 0006_genre_public_read.sql
-- Abre a leitura pública da tabela `genre` (dado de referência semeado em M1).
--
-- Lacuna corrigida: a 0004 concedeu o GRANT de SELECT em `genre` a
-- anon/authenticated, MAS `genre` tem RLS habilitada (0001) e NENHUMA policy de
-- leitura — logo o anon lia 0 linhas (deny-by-default). GRANT dá o privilégio de
-- TABELA; sem policy, o RLS nega as LINHAS. A 0003 criou a policy só para `book`.
--
-- Sem esta policy, o filtro de gênero da listagem (LST-08) e o dropdown de
-- gêneros ficam vazios, e o gênero embutido na ficha da review-page volta null
-- (omitido) para o público.
--
-- Espelha a policy de `book` (0003): SELECT liberado a anon/authenticated; a
-- escrita segue fechada (sem policy de insert/update/delete → deny-by-default,
-- RLS habilitado no M0). Idempotente via pg_policies (Postgres não tem
-- CREATE POLICY IF NOT EXISTS).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'genre' and policyname = 'genre_public_read'
  ) then
    create policy "genre_public_read" on genre for select to anon, authenticated using (true);
  end if;
end $$;
