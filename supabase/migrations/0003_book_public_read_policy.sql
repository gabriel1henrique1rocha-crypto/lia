-- 0003_book_public_read_policy.sql
-- Abre leitura pública da tabela `book` mantendo a escrita fechada (BOOK-17).
-- Postgres não tem CREATE POLICY IF NOT EXISTS → guarda via pg_policies
-- (idempotente, padrão DO do 0001). Sem policy de insert/update/delete:
-- a escrita continua deny-by-default (RLS habilitado no M0).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'book' and policyname = 'book_public_read'
  ) then
    create policy "book_public_read" on book for select to anon, authenticated using (true);
  end if;
end $$;
