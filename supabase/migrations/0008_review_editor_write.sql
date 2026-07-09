-- 0008_review_editor_write.sql
-- Escrita de `review` sob RLS (SEC-10/11, A-4). Modelo OWN-OR-ADMIN, derivado do
-- PRD §4/§6.3 e do default aprovado nesta sessão:
--   · editor: INSERT/UPDATE das PRÓPRIAS reviews (editor_id = auth.uid()),
--             incluindo PUBLICAR a própria (status draft→published — A-4);
--   · admin:  INSERT/UPDATE/DELETE de TODAS;
--   · DELETE: admin-only.
-- Reusa os helpers definer da 0007 (is_active_editor/is_admin). A leitura pública
-- (review_public_read, 0005) permanece INTACTA ao lado (SEC-13) — policies
-- permissivas se somam por OR. Migration ADITIVA e idempotente (DROP IF EXISTS +
-- CREATE). NÃO aplicar em produção aqui (STOP A-11: db push é passo humano).

-- GRANTs de TABELA (pós-2026-05-30: sem GRANT automático). SELECT já veio da 0005;
-- aqui insert/update/delete. anon NÃO recebe escrita. O GRANT de DELETE é
-- table-level; a policy abaixo o restringe a admin (row-level).
grant insert, update, delete on table public.review to authenticated;

-- SELECT do próprio rascunho (DD-10): sem isto, o editor não relê o draft que
-- acabou de criar (INSERT...RETURNING/representation do PostgREST exige SELECT na
-- linha) nem edita rascunhos. Editor vê os PRÓPRIOS (qualquer status); admin vê
-- todos. Aditiva à review_public_read (published a anon+authenticated).
drop policy if exists review_editor_read_own on public.review;
create policy review_editor_read_own on public.review
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_active_editor() and editor_id = (select auth.uid()))
  );

-- INSERT: editor cria a PRÓPRIA (editor_id = seu uid); admin cria para qualquer um.
drop policy if exists review_editor_insert on public.review;
create policy review_editor_insert on public.review
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_active_editor() and editor_id = (select auth.uid()))
  );

-- UPDATE: USING restringe as LINHAS alcançáveis (próprias, ou todas se admin);
-- WITH CHECK impede REATRIBUIR ownership (editor não pode gravar editor_id de
-- outro). Publicar a própria (status draft→published) é permitido — status não é
-- restringido pela policy (A-4).
drop policy if exists review_editor_update on public.review;
create policy review_editor_update on public.review
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_active_editor() and editor_id = (select auth.uid()))
  )
  with check (
    public.is_admin()
    or (public.is_active_editor() and editor_id = (select auth.uid()))
  );

-- DELETE: admin-only (exclusão é do fluxo admin-reviews; editor não apaga).
drop policy if exists review_admin_delete on public.review;
create policy review_admin_delete on public.review
  for delete to authenticated
  using (public.is_admin());
