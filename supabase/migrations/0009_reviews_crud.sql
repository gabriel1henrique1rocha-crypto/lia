-- 0009_reviews_crud.sql
-- Painel de resenhas (M3 `reviews-crud`): colunas novas do modelo ABNT e
-- provisionamento da ESCRITA de `book` sob RLS own-or-admin
-- (TD-03 — a 0008 cobriu só `review`). Migration ADITIVA e idempotente
-- (ADD COLUMN IF NOT EXISTS; DROP CONSTRAINT/POLICY IF EXISTS + ADD/CREATE;
-- CREATE OR REPLACE nas funções). NÃO aplicar em produção aqui
-- (STOP A-11: `db push` é passo humano pós-merge).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EMENDA 2026-08-24 — D-11 REMOVEU A NOTA DO PRODUTO.
--
-- A versão original deste arquivo trazia, na seção 2, a normalização da nota
-- legada (UPDATE editorial por slug + rede residual `round()`) e a constraint
-- `review_rating_integer`, sob D-01 (escala inteira 0–5). **D-11 supersede D-01
-- e retira a nota do produto** — a normalização e o CHECK foram REMOVIDOS.
--
-- A coluna `review.rating` NÃO foi dropada: permanece DORMENTE, com os dados de
-- produção intactos, porque o código do M1 ainda a lê (filtro e ordenação da
-- home, exibição no card e na página). O drop é o passo 4 da ORDEM DE REMOÇÃO
-- de D-11 e terá migration própria, só quando nada mais a ler. Detalhe na
-- seção 2 abaixo.
--
-- Nenhuma migration corretiva foi necessária: esta 0009 nunca chegou a
-- produção (o registro de migração de produção para na 0008), então foi
-- editada no lugar.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRATO ANTI-RECURSÃO herdado da 0007 — aplicado a `owns_book_via_review`.
--
-- A 0007 estabeleceu duas regras para policies que precisam consultar a própria
-- tabela que protegem, e ELAS CONTINUAM VALENDO aqui:
--
--   (a) O caminho SELF/BOOTSTRAP é DIRETO, sem função: `editor_self_read` usa
--       `id = (select auth.uid())`. Nunca depende de uma função definer, então
--       não há ovo-galinha no nível do self.
--
--   (b) O caminho que precisa LER a tabela para decidir (ex.: "admin vê todos")
--       usa função SECURITY DEFINER, recursion-safe PORQUE:
--         · a função é SECURITY DEFINER e seu dono é `postgres` (dono da tabela);
--         · a tabela está em NO FORCE ROW LEVEL SECURITY → o DONO bypassa a RLS.
--       Logo o SELECT interno roda sem reentrar nas policies.
--
-- COMO `owns_book_via_review` SE ENCAIXA (caso (b), com uma diferença):
-- a policy `book_editor_update` (em `book`) precisa saber se o editor é dono da
-- `review` daquele book. Aqui NÃO há auto-referência — `book` e `review` são
-- tabelas distintas, então um subselect direto não causaria 42P17. O definer é
-- necessário por outro motivo, igualmente load-bearing:
--
--   Sem o definer, o subselect em `public.review` dentro da policy de `book`
--   seria avaliado SOB A RLS DE `review` (0005/0008). Um editor só enxerga as
--   PRÓPRIAS reviews e as publicadas — então, para qualquer linha que a RLS de
--   `review` esconda, o teste de posse retornaria FALSO POR INVISIBILIDADE, não
--   por falta de posse. O oráculo confundiria "não vejo" com "não é meu" — o
--   mesmo erro de leitura que a Lesson Learned do M2 registrou nos testes de RLS.
--   O definer faz a checagem ler a VERDADE da tabela, não a projeção do papel.
--
-- PRECONDIÇÃO LOAD-BEARING: o bypass do dono só vale enquanto `public.review`
-- estiver em NO FORCE ROW LEVEL SECURITY. Isso é o DEFAULT do Postgres e a 0001
-- não o altera — mas, por ser um default não-declarado do qual esta migration
-- depende, ele é DECLARADO EXPLICITAMENTE na seção 4 abaixo (espelhando o que a
-- 0007 fez com `editor`, onde o mesmo NO FORCE é chamado de load-bearing). Se um
-- dia `review` virar FORCE RLS, `owns_book_via_review` passa a mentir.
--
-- Hardening das funções definer (idêntico ao da 0007): STABLE + `SET search_path
-- = ''` (nomes sempre qualificados: public.review, auth.uid()) para impedir
-- shadowing de objeto por schema malicioso; EXECUTE revogado de PUBLIC e
-- concedido só a `authenticated`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Colunas novas do modelo ABNT (DD-1, DD-2) ---------------------------------
-- Aditivas e nullable (ou com default), logo seguras de aplicar antes do merge:
-- o código antigo não as referencia e nenhuma leitura pública muda de forma.
alter table public.book   add column if not exists publication_city text;
alter table public.review add column if not exists reviewer_name    text;
alter table public.review add column if not exists tags             text[] not null default '{}';
alter table public.review add column if not exists keywords         text[] not null default '{}';
alter table public.review add column if not exists highlight_quote  text;
alter table public.review add column if not exists further_reading  jsonb  not null default '[]'::jsonb;

-- `further_reading` guarda um ARRAY json de {label,url}. O CHECK garante só a
-- FORMA externa (é array?); a forma dos ITENS é validada no app (Zod, design
-- §5.3). A coluna entra completa mesmo com a UI cortada do Execute (design §13)
-- — assim o schema não fica pela metade e não existe uma 0010 para completá-lo.
alter table public.review drop constraint if exists review_further_reading_is_array;
alter table public.review add  constraint review_further_reading_is_array
  check (jsonb_typeof(further_reading) = 'array');

-- 2) Nota — SEÇÃO REMOVIDA POR D-11 (2026-08-24) -------------------------------
--
-- Esta seção continha a normalização editorial da nota legada (UPDATE por slug
-- + rede residual `round()`) e a constraint `review_rating_integer`, tudo sob
-- D-01 (escala inteira 0–5). **D-11 removeu a nota do produto** e SUPERSEDED
-- D-01: a nota deixa de ser capturada, exibida, filtrada e ordenada.
--
-- Nada disso precisou de migration corretiva porque esta 0009 **nunca foi
-- aplicada em produção** — o registro de migração de produção para na 0008.
-- Ela ainda era editável, então foi editada em vez de emendada por uma 0010.
--
-- A COLUNA `review.rating` PERMANECE — não é dropada aqui, de propósito.
-- Ela existe em produção desde o M1, com dados, e o código do M1 ainda a lê
-- (home: filtro por nota mínima e ordenação "Melhor nota"; card e página de
-- resenha: exibição). D-11 fixa a ORDEM DE REMOÇÃO e esta migration é só o
-- passo 1 dela:
--
--   1. a migration para de CONSTRANGER a coluna  ← É ESTE ARQUIVO, feito aqui
--   2. a aplicação para de ESCREVER nela (M3)
--   3. a aplicação para de LER/filtrar/ordenar por ela — SÓ depois que o filtro
--      por deficiência representada (D-12) existir, senão a home fica sem
--      filtro algum
--   4. migration DEDICADA dropa a coluna — só quando nada mais a lê
--
-- Entre os passos 2 e 4 a coluna fica DORMENTE com os dados intactos: nada
-- escreve, o que já estava gravado permanece. É o que mantém a decisão
-- reversível sem restaurar backup. O passo 4 é a única porta de mão única.
--
-- O CHECK 0–5 original da 0001 (`review_rating_check` ou equivalente) NÃO é
-- tocado por esta migration — continua vigente sobre a coluna dormente, e sai
-- junto com ela no passo 4.
--
-- NOTA PARA AMBIENTE LOCAL: um banco local que tenha aplicado a versão
-- PRÉ-EMENDA desta 0009 ainda carrega a constraint `review_rating_integer`.
-- Como o Supabase marca a migration como aplicada, reexecutá-la não a remove —
-- rode `npx supabase db reset` para reconstruir o schema a partir do arquivo
-- atual. Nenhum drop defensivo foi deixado aqui: esta migration não cria mais
-- essa constraint, e um `drop` de objeto que o próprio arquivo não cria só
-- confundiria quem for lê-lo depois.

-- 3) GRANTs de TABELA para escrita de `book` (TD-03, REV-07-schema) -------------
-- SELECT já veio de 0003/0004 (leitura pública). Pós-2026-05-30 o Supabase não
-- auto-concede GRANTs: sem isto a escrita autenticada morre em 42501, mesmo com
-- as policies da seção 4. `anon` NÃO recebe escrita (permanece só com o SELECT
-- da 0004). O GRANT de DELETE é table-level; a policy abaixo o restringe a admin.
grant insert, update, delete on table public.book to authenticated;
-- `review` já tem insert/update/delete a `authenticated` (0008, TABLE-level) →
-- as colunas novas da seção 1 são cobertas automaticamente, sem grant por coluna.

-- 4) Posse de `book` sob RLS — own-or-admin transitivo (DD-4) -------------------
-- `review.book_id` é UNIQUE (0001) → relação 1—1. Logo a posse do `book` é, sem
-- ambiguidade, a posse da sua única `review`.

-- NO FORCE explícito: precondição load-bearing do definer abaixo (ver cabeçalho).
-- É o default do Postgres; declaramos para que a dependência fique versionada e
-- para que ativar FORCE em `review` seja uma mudança VISÍVEL neste arquivo.
alter table public.review no force row level security;

-- "o editor é dono do book via a review 1—1?" — mesmo hardening da 0007.
create or replace function public.owns_book_via_review(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.review r
    where r.book_id = p_book_id and r.editor_id = auth.uid()
  )
$$;

revoke all on function public.owns_book_via_review(uuid) from public;
grant execute on function public.owns_book_via_review(uuid) to authenticated;

-- INSERT: qualquer editor ATIVO. No instante do INSERT a `review` ainda não
-- existe (ordem livro→resenha dentro do RPC), então não há posse a verificar; a
-- posse se estabelece na `review` da MESMA transação. Um `book` órfão é inócuo:
-- invisível ao público e o `book` já é catálogo de leitura pública (A-2/T-1).
drop policy if exists book_editor_insert on public.book;
create policy book_editor_insert on public.book
  for insert to authenticated
  with check (public.is_active_editor());

-- UPDATE: admin (todas) OU o editor dono da review daquele book. USING restringe
-- as LINHAS alcançáveis; WITH CHECK impede que o UPDATE deixe a linha num estado
-- que o próprio papel não poderia alcançar (mesmo par da 0008).
drop policy if exists book_editor_update on public.book;
create policy book_editor_update on public.book
  for update to authenticated
  using      (public.is_admin() or public.owns_book_via_review(id))
  with check (public.is_admin() or public.owns_book_via_review(id));

-- DELETE: admin-only (espelha o DELETE de `review` da 0008; o formulário não
-- deleta — a UI de exclusão é da feature `admin-reviews`).
drop policy if exists book_admin_delete on public.book;
create policy book_admin_delete on public.book
  for delete to authenticated
  using (public.is_admin());

-- `book_public_read` (0003) permanece INTACTA ao lado: policies permissivas se
-- somam por OR, então o SELECT anônimo da ficha pública não é afetado (SEC-13).
