-- 0009_reviews_crud.sql
-- Painel de resenhas (M3 `reviews-crud`): colunas novas do modelo ABNT, nota
-- inteira 0–5 (D-01) e provisionamento da ESCRITA de `book` sob RLS own-or-admin
-- (TD-03 — a 0008 cobriu só `review`). Migration ADITIVA e idempotente
-- (ADD COLUMN IF NOT EXISTS; DROP CONSTRAINT/POLICY IF EXISTS + ADD/CREATE;
-- CREATE OR REPLACE nas funções). NÃO aplicar em produção aqui
-- (STOP A-11: `db push` é passo humano pós-merge).
--
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

-- 2) Nota inteira 0–5 (D-01, DD-3) ---------------------------------------------
--
-- ⚠️  ORDEM OBRIGATÓRIA — NÃO REORDENAR ESTE BLOCO.
--     Os UPDATEs de normalização vêm ANTES do ADD CONSTRAINT, e a inversão
--     QUEBRA A MIGRATION EM PRODUÇÃO: `dom-casmurro` e `iracema` estão gravadas
--     com 4,5 (verificado em produção 2026-08-09), então a constraint seria
--     violada NO INSTANTE DA CRIAÇÃO e o `db push` abortaria. Normalizar depois
--     é tarde — o ADD CONSTRAINT valida as linhas existentes na hora.
--     Quem "organizar" este arquivo movendo DDL para cima quebra o deploy.
--
-- NORMALIZAÇÃO EDITORIAL EXPLÍCITA (A-3, resolvido por verificação empírica):
-- os valores 5 e 4 abaixo são ESCOLHA EDITORIAL do autor, NÃO arredondamento.
-- `round()` foi rejeitado como estratégia para estas duas linhas: sobre `numeric`
-- o Postgres arredonda meio PARA LONGE DO ZERO, então ambas virariam 5 — e 3 das
-- 4 resenhas ficariam com nota 5, achatando a listagem e inutilizando a ordenação
-- "Melhor nota" (design §2.2 e §13/A-3).
update public.review set rating = 5 where slug = 'dom-casmurro';
update public.review set rating = 4 where slug = 'iracema';

-- REDE RESIDUAL: pega qualquer não-inteiro remanescente — linha criada entre a
-- verificação e o push, ou ambiente (local/staging) cujo dado divirja do de
-- produção. Idempotente: após os dois UPDATEs acima não casa com nada no dado
-- conhecido de produção. Aqui `round()` é aceitável porque é rede, não política:
-- não existe escolha editorial possível para uma linha que ninguém revisou.
update public.review set rating = round(rating)
  where rating is not null and rating <> trunc(rating);

-- Só AGORA a constraint. O CHECK 0–5 original da 0001 continua vigente ao lado;
-- este acrescenta a INTEGRALIDADE. A coluna permanece `numeric(2,1)` (não é
-- recriada) — afrouxar para meio-ponto no futuro é só trocar este CHECK.
alter table public.review drop constraint if exists review_rating_integer;
alter table public.review add  constraint review_rating_integer
  check (rating is null or (rating >= 0 and rating <= 5 and rating = trunc(rating)));

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
