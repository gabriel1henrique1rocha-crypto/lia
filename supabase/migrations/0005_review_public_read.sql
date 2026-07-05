-- 0005_review_public_read.sql
-- Abre a LEITURA PÚBLICA de `review` filtrada por status='published', mantendo a
-- escrita fechada (RVW-13/14/15). Arquivo único (policy + grant) porque o escopo
-- é só `review` — diferente do par 0003/0004, cujo GRANT cobria `book` + `genre`.
--
-- Dois gates independentes protegem o rascunho do público:
--   1) o filtro status='published' explícito na query (queries.ts) — vale mesmo
--      quando o server client usa service_role (que ignora RLS);
--   2) esta policy RLS + GRANT — o gate para o caminho anon/publishable e para
--      qualquer consumo anônimo do Data API.
--
-- Postgres não tem CREATE POLICY IF NOT EXISTS → guarda via pg_policies
-- (idempotente, padrão DO do 0001/0003). Sem policy de insert/update/delete:
-- a escrita permanece deny-by-default até o M2 (reviews-crud). RLS continua
-- habilitado (não há alter table ... disable row level security).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review' and policyname = 'review_public_read'
  ) then
    create policy "review_public_read" on review for select to anon, authenticated using (status = 'published');
  end if;
end $$;

-- GRANT de tabela explícito (RVW-14). Pós-2026-05-30 o Supabase deixou de
-- auto-conceder GRANTs a tabelas novas do schema public — sem ele o SELECT
-- anônimo/Data API falha com 42501 mesmo com a policy acima. GRANT é idempotente.
--
-- FORA de escopo (TD-03, permanece ABERTA — pré-M2): GRANTs de `comment`,
-- `recommendation`, `editor` e do `service_role`/Data API. Este arquivo NÃO
-- fecha a TD-03; concede leitura apenas de `review`.
grant select on table review to anon, authenticated;
