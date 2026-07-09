-- 0007_editor_rbac.sql
-- RBAC de `editor`: funções de papel (SECURITY DEFINER) + GRANTs de tabela +
-- policies RLS. Migration ADITIVA e idempotente (DROP POLICY IF EXISTS + CREATE;
-- CREATE OR REPLACE nas funções). NÃO aplicar em produção aqui (STOP A-11:
-- db push é passo humano pós-merge).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRATO ANTI-RECURSÃO (código crítico — auditoria A-1). RLS em `editor` com
-- policy que precisa consultar `editor` (ex.: "admin vê todos") recorre
-- infinitamente (42P17) se a consulta reentrar na própria RLS. Resolvemos com
-- DUAS regras que se reforçam:
--
--   (a) O caminho SELF/BOOTSTRAP é DIRETO, sem função: `editor_self_read` usa
--       `id = (select auth.uid())`. É o caminho que requireEditor()/resolveEditor
--       usam para resolver o papel — ele nunca depende de uma função definer,
--       então não há ovo-galinha nem auto-referência no nível do self.
--
--   (b) O caminho ADMIN ("vê/gerencia todos") PRECISA ler `editor` para saber se
--       auth.uid() é admin — impossível sem recursão via subselect direto. Usa a
--       função definer `is_admin()`, recursion-safe PORQUE:
--         · a função é SECURITY DEFINER e seu dono é `postgres` (dono da tabela);
--         · `editor` está em NO FORCE ROW LEVEL SECURITY → o DONO bypassa a RLS.
--       Logo o SELECT interno da função roda sem reentrar nas policies. Se algum
--       dia `editor` virar FORCE RLS, a recursão VOLTA — por isso o NO FORCE é
--       declarado explicitamente abaixo e é load-bearing.
--
-- Hardening das funções definer: STABLE + `SET search_path = ''` (nomes sempre
-- qualificados: public.editor, auth.uid()) para impedir shadowing de objeto por
-- schema malicioso; EXECUTE revogado de PUBLIC e concedido só a `authenticated`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Funções de papel ---------------------------------------------------------

-- Papel do editor ATIVO correspondente a auth.uid(), ou NULL. É a ÚNICA função
-- que lê a tabela; as demais derivam dela (sem tocar a tabela).
create or replace function public.current_editor_role()
returns public.editor_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.editor e
  where e.id = auth.uid() and e.active
$$;

-- Deriva "é admin ativo?" — fail-closed (coalesce para false quando NULL).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_editor_role() = 'admin'::public.editor_role, false)
$$;

-- Deriva "é editor ativo (qualquer papel)?" — usado pelas policies de `review`.
create or replace function public.is_active_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_editor_role() is not null
$$;

-- EXECUTE: revoga de PUBLIC, concede só a authenticated (anon não invoca papel).
revoke all on function public.current_editor_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_active_editor() from public;
grant execute on function public.current_editor_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_editor() to authenticated;

-- 2) GRANTs de TABELA (breaking change pós-2026-05-30: sem GRANT automático) ---
-- Sem GRANT, a policy não basta e o Data API devolve 42501. anon NÃO recebe nada
-- (A-2: deny total). DELETE fora (desativar = active=false, não apagar — C-4).
grant select, insert, update on table public.editor to authenticated;

-- 3) RLS: habilitada (já vem de 0001) + NO FORCE explícito (contrato b) ---------
alter table public.editor enable row level security;
alter table public.editor no force row level security;

-- 4) Policies (idempotentes via DROP IF EXISTS + CREATE) -----------------------

-- SELF (a): direto, sem função. Cada editor lê a PRÓPRIA linha.
drop policy if exists editor_self_read on public.editor;
create policy editor_self_read on public.editor
  for select to authenticated
  using (id = (select auth.uid()));

-- ADMIN read (b): admin ativo lê TODAS. Via definer → recursion-safe.
drop policy if exists editor_admin_read on public.editor;
create policy editor_admin_read on public.editor
  for select to authenticated
  using (public.is_admin());

-- ADMIN insert (C-4): só admin provisiona editores.
drop policy if exists editor_admin_insert on public.editor;
create policy editor_admin_insert on public.editor
  for insert to authenticated
  with check (public.is_admin());

-- ADMIN update: só admin altera papel/active. with check impede rebaixar a linha
-- para um estado que o próprio admin não poderia criar.
drop policy if exists editor_admin_update on public.editor;
create policy editor_admin_update on public.editor
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
