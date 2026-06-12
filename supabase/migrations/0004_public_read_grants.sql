-- 0004_public_read_grants.sql
-- GRANTs de tabela necessários para a LEITURA PÚBLICA da ficha (BOOK-17).
--
-- A policy RLS (0003) filtra LINHAS, mas o PostgREST/Data API também exige o
-- privilégio de TABELA (GRANT) para o papel — senão o SELECT anônimo falha com
-- 42501 "permission denied for table ...".
--
-- Pós-2026-05-30 o Supabase deixou de auto-conceder GRANTs a tabelas novas do
-- schema public (auto_expose_new_tables → false por padrão; campo removido em
-- out/2026). Por isso tornamos os grants EXPLÍCITOS e versionados — declarativos
-- e à prova da remoção do campo. GRANT é idempotente (reconceder é no-op).
--
-- Escopo desta feature: a ficha pública é `book` + o gênero embutido no join
-- (`queries.ts`: select '*, genre(name, slug)'; a ficha exibe o nome do gênero).
-- `genre` é dado de referência público (semeado em BOOK-15). Por isso ambos.
--
-- FORA de escopo (frente de infra — ver TD-03): GRANTs de `review`, `comment`,
-- `recommendation`, `editor` e do `service_role`/Data API.
grant select on table book to anon, authenticated;
grant select on table genre to anon, authenticated;
