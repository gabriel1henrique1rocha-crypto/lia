# reviews-crud — Tasks

**Design**: [design.md](design.md) (DD-1..18, §1–§13 — **APROVADO com emendas 2026-08-09**) · **Spec**: [spec.md](spec.md) (REV-01..24 + REV-07-schema) · **Context**: [context.md](context.md) (gray areas resolvidas)
> ---
> **EMENDA 2026-08-24 — [D-11](../../project/DECISIONS.md) REMOVEU A NOTA DO PRODUTO** (supersede D-01). A `0009` já foi emendada (normalização + `review_rating_integer` fora). **T9 está REMOVIDA** — texto preservado, sem renumerar. **T5/T8/T11/T12 encolhem.** **T4 precisa de novo injetor de falha** (dependia do CHECK de nota — ver a task). A coluna `review.rating` **não é dropada**: fica dormente. **EMENDA POSTERIOR (mesmo dia): a ORDEM DE REMOÇÃO foi COLAPSADA** — a regressão do M1 **FOI EXECUTADA** nesta leva, junto com o drop da coluna pela **0010**. Ver "PENDÊNCIA DE REGRESSÃO DO M1 — EXECUTADA" em Diferidos. A `0010` aguarda `db push` humano.

**Status**: Execute em curso — **T1 CONCLUÍDA** (pt.1 da 0009 commitada; os 9 "Done when" fechados com evidência medida em 2026-08-24, ver bloco "T1 — EVIDÊNCIAS DE FECHAMENTO"). T2 em diante não iniciada.

> **Escopo já reduzido pelo Design (§13, não é corte desta fase):** `further_reading`/`RepeatableLinks`, chips dinâmicos de tags/keywords (→ input único separado por vírgula), `update_review_with_book` exercido pelo app e a rota `/admin/resenhas/[id]/editar` estão **FORA do Execute**. A 0009 continua **ÍNTEGRA** (todas as colunas, o CHECK, os GRANTs, as policies de `book`, **ambos** os RPCs, o helper de slug) — o corte é só na superfície de UI/app. Ver seção **Diferidos** abaixo para o mapeamento requisito→estado.
> **Calendário real: 3 dias, ~3h/dia, SEM buffer** (13–15/08/2026). Ver seção **Plano de Corte** para o que sai *desta* janela se o tempo apertar — é um plano de contingência de cronograma, distinto do corte já feito pelo Design.
> **`db push` de produção NÃO é uma task** — passo humano pós-merge (A-11 herdado do M2), no fim do dia 15. Ver checklist ao final.
> **a11y WCAG 2.1 AA é DoD embutida** nas tasks de UI (T8, T9, T10, T11, T12) — não existe task de a11y separada.

---

## Gate Check Commands

Mesmo padrão de `security-foundation`/`review-listing-search` — o gate local espelha o CI.

| Nível | Comando | Quando |
| --- | --- | --- |
| **quick** | `npm run typecheck && npm run lint && npm run format:check && npm test` | toda task de lógica/componente (unit) |
| **full** | quick **+** `npm run test:a11y` | tasks que criam/alteram rota (axe na rota nova) |
| **build** | `npm run build` | provas de compilação/fronteira |
| **integration (local-only, TD-02)** | `npx supabase start && npx supabase db reset` → `$env:RUN_RLS_INTEGRATION='1'; npx vitest run <arquivo>` | policies/GRANTs/RPC contra Supabase local; **CI PULA** via `describe.skipIf` |

**Baseline atual:** `192 passed / 36 skipped` (pós-merge das emendas do design, `main` em `1de7a0e`). Todo "Done when" exige baseline verde + novos testes passando.

### Matriz de cobertura derivada (precedente do repo)

| Camada criada/modificada | Teste exigido | Precedente |
| --- | --- | --- |
| Migration SQL (colunas/CHECK/GRANTs/policies) | **integration** local-only (matriz por papel + inspeção `pg_policies`) | 0007/0008 |
| RPC transacional (`SECURITY INVOKER`) | **integration** local-only (matriz de rollback — A-9, task própria) | precedente novo desta feature |
| Função pura / módulo (`lib/**`) | **unit** (Vitest) | `formatRating.test.ts`, `isbn.test.ts` |
| Fábrica/leitura via client autenticado | **unit** (contrato) + **integration** local p/ efeito RLS | `rls.integration.test.ts` (TD-02) |
| Componente React (render/semântica/aria) | **unit** (Testing Library) | `Rating.test.tsx` |
| `page.tsx`/route (SSR wiring) | **a11y de rota** (axe) + build; lógica extraível → unit | `review-page`, `admin/login` |
| Config/regen de tipos | **none** (o próprio gate/typecheck é a prova) | `database.types.ts` pós-0006 |

---

## Execution Plan

### Dia 13/08 — 0009 + RPC + provas de banco (sequencial no banco local)

```
T1 (0009 parte A: colunas + CHECK + GRANTs/policies de book) ──► T2 (0009 parte B: RPCs + slug helper + regen tipos)
T1 ──► T3 (matriz RLS de book)                    [P com T2]
T1,T2 ──► T4 (rollback/atomicidade do RPC — A-9)
```

### Dia 14/08 — schema, actions, form, rotas (paralela onde possível)

```
T5 (reviewInputSchema + slugify)                              [P, independente do banco]
T2,T5 ──► T6 (actions.ts: create/publish/unpublish + gate)
T1 ──► T7 (adminQueries: listEditorReviews)                   [P com T6]
T5 ──► T8 (ReviewForm — scaffolding)
T5 ──► T9 (RatingInput — a11y)   ◄── REMOVIDA POR D-11 (não executar)
T6,T7,T8,T9 ──► T10 (rotas /admin/resenhas + /nova)
```

### Dia 15/08 — exibição pública + ensaio (db push FORA das tasks)

```
T1,T2,T6 ──► T11 (exibição pública A — reviewer_name/highlight_quote/publication_city) [CORTÁVEL #1]
T1,T2,T6 ──► T12 (exibição pública B — tags/keywords)                [P com T11]
T1..T12 ──► T13 (ensaio final: gate full + axe + NVDA + checklist de merge)
T13 ──► [FORA] db push produção (STOP humano, A-11) + verificação no ar
```

### Tasks por dia (explícito — é o que torna o gatilho do Plano de Corte verificável)

| Dia | Tasks |
| --- | --- |
| **13/08** | T1, T2, T3, **T4** |
| **14/08** | T5, T6, T7, T8, T9, T10 |
| **15/08** | T11, T12, T13 |

O gatilho do Corte #1 ("fim do dia 13") é literalmente: **T4 não verde depois de T1–T3 concluídas nesse mesmo dia.**

---

## Task Breakdown

### T1: Migration `0009` parte A — colunas aditivas + CHECK de nota + GRANTs/policies de `book`

**What**: Escrever no início de `0009_reviews_crud.sql` (design §2.1–§2.4, **exatamente** como especificado): colunas aditivas (`book.publication_city`, `review.reviewer_name/tags/keywords/highlight_quote/further_reading` + CHECK `is_array`); normalização da nota — **UPDATE editorial explícito por slug** (`dom-casmurro`→5, `iracema`→4) **seguido** da rede residual `round()` idempotente, **depois** o CHECK `review_rating_integer` (A-3, já resolvido — não reabrir a escolha, só implementar); `grant insert, update, delete on book to authenticated`; helper `owns_book_via_review` (`stable security definer set search_path=''`) + policies `book_editor_insert`/`book_editor_update`/`book_admin_delete`. **Cabeçalho do arquivo** deve documentar o **contrato anti-recursão herdado da 0007** (self direto + admin via função `security definer`, editor `NO FORCE`) e como `owns_book_via_review` o respeita (não reentra na RLS de `review`). Aplicar **apenas local** (`db reset`). **NÃO** rodar `db push`.
**Where**: `supabase/migrations/0009_reviews_crud.sql` (novo)
**Depends on**: None (banco local independente do código de app)
**Reuses**: padrão de idempotência 0003/0005/0006/0007/0008; `is_active_editor()`/`is_admin()` da 0007 (sem alteração)
**Requirement**: REV-06, REV-07 (CHECK), REV-07-schema, D-01, DD-1/2/3/4
**Model**: **Opus** (SQL de GRANTs/RLS + normalização de dado real de produção — revisão linha a linha)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `npx supabase db reset` local verde, **duas vezes seguidas** (idempotência via guards `if not exists`/`drop ... if exists`) — **evidência E-1**
- [x] `pg_policies` local mostra as 3 novas policies de `book`; `book_public_read` (0003) intacta ao lado — **evidência E-2**
- [x] Cabeçalho do arquivo documenta o contrato anti-recursão do 0007 (self direto + admin via função `security definer`, editor `NO FORCE`) e como `owns_book_via_review` o respeita — **evidência E-3**
- [x] **Ordem interna da migration verificada (crítico):** dentro do arquivo, os dois UPDATEs de normalização editorial (por slug + rede residual `round()`) executam **antes** de `alter table ... add constraint review_rating_integer` — exatamente a ordem de design.md §2.2, não uma reordenação nova — **evidência E-4**
- [x] **Precondição do teste — banco com nota não-inteira antes de aplicar:** exige um banco onde pelo menos uma linha tenha nota não-inteira **antes** de a 0009 rodar. Aplicar a 0009 contra um banco **já normalizado** (sem nenhuma linha não-inteira) **não satisfaz este critério** — a ordem não teria sido de fato exercitada, só coincidentemente não-testada. **Satisfeito pelo item imediatamente abaixo** (a corrida de 2026-08-12 partiu do `seed.sql` da época, com `dom-casmurro`/`iracema`/`rascunho` todos em 4,5 — três linhas não-inteiras ANTES da 0009; os três `UPDATE 1` provam que havia o que normalizar). **Evidência E-5**
- [x] **EXERCITADO em 2026-08-12, via `psql` direto (não pelo `supabase db reset` do CLI — ver nota abaixo).** Sequência: aplicar 0001→0008 + o `seed.sql` **da época** (que ainda gravava `dom-casmurro`=4,5, `iracema`=4,5, `memorias-postumas-rascunho`=4,5) → aplicar a 0009 por cima. 1ª aplicação: `UPDATE 1` (dom-casmurro→5) + `UPDATE 1` (iracema→4) + `UPDATE 1` (rede residual pegou o rascunho, 4,5→5) → `EXIT=0`. **Prova de vermelhidão** (a ordem é mesmo load-bearing, não só a ordem certa "funciona por acaso"): simulada a inversão em transação com rollback — `drop constraint` → `update rating=4.5` → `add constraint` → `ERROR: check constraint "review_rating_integer" ... is violated by some row`, exatamente como esperado se a normalização não tivesse rodado antes. 2ª aplicação (mesmo arquivo, banco já normalizado): idempotente — colunas `already exists, skipping`, `UPDATE 0` na rede residual, ratings inalterados, `EXIT=0`.
- [x] **`seed.sql` corrigido em seguida (fix(seed), commit `6b1edd9` em `feat/reviews-crud`)** — `dom-casmurro`=5, `iracema`=4, `memorias-postumas-rascunho`=4, gravados como inteiros diretamente (não mais 4,5). **Consequência para este critério, registrada para não confundir quem rodar de novo:** a partir dessa correção, um `supabase db reset` do CLI (que aplica migrations e SÓ DEPOIS o seed) **não exercita mais este bloco** — a 0009 roda contra um banco vazio, os dois UPDATEs editoriais e a rede residual viram no-op (nenhuma linha para tocar), e o seed já entra inteiro. **Isso é o comportamento correto e esperado**, não uma lacuna: a normalização por slug é um evento **histórico**, que roda **uma vez** contra o dado real de produção (que tinha 4,5); depois disso, tanto local quanto produção nunca mais têm nota não-inteira, e o bloco de UPDATEs fica como cicatriz documentada no arquivo, não como algo a re-exercitar a cada reset. A evidência de que a ordem é load-bearing é a prova de vermelhidão acima, não uma repetição indefinida do "reset comum".
- [x] Confirmado via `db reset` completo do CLI **depois** da correção do seed (2026-08-12): 0001→0009 aplicadas, seed rodou sem erro, `rating` inteiro nas 5 linhas (`dom-casmurro`=5, `iracema`=4, `memorias-postumas-rascunho`=4, `o-crime-do-padre-amaro`=4, `o-cortico`=5) — oráculo `psql` superuser, não o papel sob teste
- [x] Nenhum GRANT de escrita de `book` a `anon` **concedido por esta migration** — a 0009 só faz `grant insert, update, delete on table public.book to authenticated` (linha 109; nunca `anon`). **VERIFICADO LOCALMENTE em 2026-08-24: `anon` NÃO tem INSERT, UPDATE nem DELETE em `public.book`** — **evidência E-6**.
  > **CORREÇÃO DE REGISTRO (2026-08-24).** A redação anterior deste critério afirmava que a ausência de GRANT era "**não verificável** no stack local / **produção-only**", porque o local teria `ALTER DEFAULT PRIVILEGES` concedendo INSERT/UPDATE/DELETE a `anon` em toda tabela nova do `public`. **Essa afirmação estava errada e foi refutada por medição** (E-6). `supabase db reset` reconstrói o schema a partir das migrações, GRANTs inclusive — a verificação é local e é a mais sensível das seis. O que o default ACL aplicável concede a `anon` é `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), **não** `awd` (INSERT/UPDATE/DELETE). A leitura antiga provavelmente confundiu `REFERENCES/TRIGGER/TRUNCATE` na listagem com "GRANTs amplos de escrita". Mesma correção vale para o residual gêmeo na T3.

**Tests**: integration (matriz completa na T3; aqui: reset + inspeção `pg_policies`/`pg_constraint`) · **Gate**: integration (local)
**Verify**: `npx supabase db reset` (2×) + `psql` local em `pg_policies`/`pg_constraint` (`review_rating_integer`).
**Commit**: `feat(db): 0009 pt.1 — colunas + CHECK de nota (A-3) + GRANTs/policies de book (REV-06/07/07-schema, D-01)`

### T1 — EVIDÊNCIAS DE FECHAMENTO (2026-08-24)

Corrida de verificação contra o **stack Supabase LOCAL** (Docker), branch `feat/reviews-crud` em `14615a4`. Nenhum comando tocou o projeto remoto: `db reset` sem `--linked` opera só no local; as leituras são `docker exec supabase_db_lia psql -U postgres` — **oráculo superuser**, não o papel sob teste (Lesson Learned do M2). A 0009 **não foi editada** nesta corrida. Saídas coladas na íntegra, como emitidas.

**E-1 — reset 2× (critério 1).** Duas execuções consecutivas, ambas `EXIT=0`:

```
$ npx supabase db reset          # 1ª
Applying migration 0001_core_schema.sql...
...
Applying migration 0009_reviews_crud.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch feat/reviews-crud.
EXIT=0

$ npx supabase db reset          # 2ª, imediatamente depois
Applying migration 0001_core_schema.sql...
...
Applying migration 0009_reviews_crud.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch feat/reviews-crud.
EXIT=0
```

**E-2 — policies de `book` (critério 2).** As 3 novas presentes; `book_public_read` (0003) intacta ao lado, ainda para `{anon,authenticated}`:

```
$ psql -c "select policyname, cmd, roles from pg_policies
           where schemaname='public' and tablename='book' order by policyname;"

     policyname     |  cmd   |        roles
--------------------+--------+----------------------
 book_admin_delete  | DELETE | {authenticated}
 book_editor_insert | INSERT | {authenticated}
 book_editor_update | UPDATE | {authenticated}
 book_public_read   | SELECT | {anon,authenticated}
(4 rows)
```

Constraints da 0009 conferidas no mesmo reset:

```
 review_further_reading_is_array | CHECK ((jsonb_typeof(further_reading) = 'array'::text))
 review_rating_integer           | CHECK (((rating IS NULL) OR ((rating >= (0)::numeric)
                                   AND (rating <= (5)::numeric) AND (rating = trunc(rating)))))
```

**E-3 — cabeçalho anti-recursão (critério 3).** `0009_reviews_crud.sql` linhas 9–49 trazem a seção `CONTRATO ANTI-RECURSÃO herdado da 0007`, cobrindo os três pontos exigidos — (a) self direto sem função, (b) admin via `SECURITY DEFINER` + `NO FORCE`, e como `owns_book_via_review` se encaixa. Trecho literal:

```sql
-- CONTRATO ANTI-RECURSÃO herdado da 0007 — aplicado a `owns_book_via_review`.
--   (a) O caminho SELF/BOOTSTRAP é DIRETO, sem função: `editor_self_read` usa
--       `id = (select auth.uid())`. (...)
--   (b) O caminho que precisa LER a tabela para decidir (ex.: "admin vê todos")
--       usa função SECURITY DEFINER, recursion-safe PORQUE:
--         · a função é SECURITY DEFINER e seu dono é `postgres` (dono da tabela);
--         · a tabela está em NO FORCE ROW LEVEL SECURITY → o DONO bypassa a RLS.
-- COMO `owns_book_via_review` SE ENCAIXA (caso (b), com uma diferença): (...)
--   Sem o definer, o subselect em `public.review` dentro da policy de `book`
--   seria avaliado SOB A RLS DE `review` (0005/0008). (...) o teste de posse
--   retornaria FALSO POR INVISIBILIDADE, não por falta de posse.
-- PRECONDIÇÃO LOAD-BEARING: o bypass do dono só vale enquanto `public.review`
-- estiver em NO FORCE ROW LEVEL SECURITY. (...)
```

**E-4 — ordem interna (critério 4).** Números de linha reais no arquivo. Os três UPDATEs (86, 87, 94) vêm **antes** do `add constraint review_rating_integer` (101):

```
$ grep -n "update public.review set rating|constraint review_rating_integer" 0009_reviews_crud.sql

 86: update public.review set rating = 5 where slug = 'dom-casmurro';
 87: update public.review set rating = 4 where slug = 'iracema';
 94: update public.review set rating = round(rating)
100: alter table public.review drop constraint if exists review_rating_integer;
101: alter table public.review add  constraint review_rating_integer
```

86 < 87 < 94 < 101 — ordem de design.md §2.2 preservada, sem reordenação.

**E-5 — precondição de nota não-inteira (critério 5).** Coberta pelo item `EXERCITADO em 2026-08-12` da lista acima (4º item marcado), que registra a corrida partindo do `seed.sql` da época com **três linhas em 4,5** (`dom-casmurro`, `iracema`, `memorias-postumas-rascunho`) e a 0009 aplicada por cima, produzindo `UPDATE 1` + `UPDATE 1` + `UPDATE 1` — havia dado não-inteiro a normalizar, logo a ordem foi de fato exercitada, não coincidentemente não-testada. A prova de vermelhidão (inversão simulada em transação com rollback → `ERROR: check constraint "review_rating_integer" ... is violated by some row`) está no mesmo item. Estado após o reset de hoje (já com o seed corrigido, portanto **sem** re-exercitar o bloco — comportamento esperado, ver item seguinte):

```
            slug            | rating | inteiro
----------------------------+--------+---------
 dom-casmurro               |    5.0 | t
 iracema                    |    4.0 | t
 memorias-postumas-rascunho |    4.0 | t
 o-cortico                  |    5.0 | t
 o-crime-do-padre-amaro     |    4.0 | t
(5 rows)
```

**E-6 — ausência de GRANT de escrita a `anon` (critério 6).** O critério mais sensível dos seis, e **verificável localmente** — `db reset` reconstrói o schema a partir das migrações, GRANTs inclusive:

```
$ psql -c "select grantee, privilege_type from information_schema.role_table_grants
           where table_schema='public' and table_name='book'
           order by grantee, privilege_type;"

    grantee    | privilege_type
---------------+----------------
 anon          | REFERENCES
 anon          | SELECT
 anon          | TRIGGER
 anon          | TRUNCATE
 authenticated | DELETE
 authenticated | INSERT
 authenticated | REFERENCES
 authenticated | SELECT
 authenticated | TRIGGER
 authenticated | TRUNCATE
 authenticated | UPDATE
 postgres      | (todos)
 service_role  | REFERENCES
 service_role  | TRIGGER
 service_role  | TRUNCATE
(21 rows)
```

`anon` tem **SELECT** (concedido explicitamente pela 0004, leitura pública da ficha — SEC-13) e **nada de INSERT/UPDATE/DELETE**. `authenticated` tem os três, como a 0009 pretendia. **Critério satisfeito.**

Causa-raiz do que a redação antiga leu errado — o default ACL aplicável a tabelas criadas por `postgres` (que é como as migrações rodam) concede a `anon` apenas `Dxtm`, não `awd`:

```
$ psql -c "select defaclrole::regrole as grantor, nspname as schema, defaclacl
           from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace
           where defaclobjtype='r';"

  grantor   | schema |                         defaclacl
------------+--------+------------------------------------------------------------
 postgres   | public | {postgres=arwdDxtm/postgres, anon=Dxtm/postgres,
                       authenticated=Dxtm/postgres, service_role=Dxtm/postgres}
```

`a`=INSERT, `r`=SELECT, `w`=UPDATE, `d`=DELETE, `D`=TRUNCATE, `x`=REFERENCES, `t`=TRIGGER, `m`=MAINTAIN. Para `anon`: só `Dxtm`. A linha `supabase_admin | public | anon=arwdDxtm` existe ao lado, mas **não se aplica** — vale para tabelas criadas por `supabase_admin`, e as nossas são criadas por `postgres`. Confirmado tabela a tabela: nenhuma tabela do `public` dá INSERT/UPDATE/DELETE a `anon`.

```
   table_name   | grantee |               privs
----------------+---------+------------------------------------
 book           | anon    | REFERENCES,SELECT,TRIGGER,TRUNCATE
 comment        | anon    | REFERENCES,TRIGGER,TRUNCATE
 editor         | anon    | REFERENCES,TRIGGER,TRUNCATE
 genre          | anon    | REFERENCES,SELECT,TRIGGER,TRUNCATE
 recommendation | anon    | REFERENCES,TRIGGER,TRUNCATE
 review         | anon    | REFERENCES,SELECT,TRIGGER,TRUNCATE
```

> **ACHADO LATERAL (não é falha deste critério, mas fica registrado):** `anon` **tem `TRUNCATE`** em todas as 6 tabelas do `public` — herdado do default ACL (`D`), **não** concedido por nenhuma migration. Importa porque **TRUNCATE ignora RLS**: se algum dia for alcançável, a policy não protege. Hoje **não é alcançável pelo Data API** — PostgREST só emite SELECT/INSERT/UPDATE/DELETE e chamadas de função, nunca TRUNCATE. Revogar (`revoke truncate on all tables in schema public from anon`) é **decisão de arquitetura**, fora do escopo desta verificação; registrado para avaliação.

**Status de T1: Concluída** — os 9 critérios de "Done when" estão `[x]` com evidência medida.

> **NOTA POSTERIOR (2026-08-24, D-11).** A 0009 foi **emendada depois** deste fechamento: a normalização da nota e a constraint `review_rating_integer` saíram do arquivo. Consequência para as evidências acima, registrada para não induzir a erro:
>
> - **E-4 (ordem interna) e E-5 (precondição de nota não-inteira)** passam a descrever um **bloco que não existe mais**. Ficam como registro histórico do que foi verificado enquanto o bloco existia — não são reexecutáveis, e não precisam ser: o objeto que protegiam saiu.
> - **E-1 (reset 2×), E-2 (policies de `book`) e E-6 (ausência de GRANT de escrita a `anon`) foram RE-VERIFICADOS após a emenda** e continuam válidos: dois `db reset` `EXIT=0`, as 4 policies de `book` intactas, `anon` sem INSERT/UPDATE/DELETE, e `review_rating_integer` agora **ausente** (`0 rows`), com a coluna `rating` presente como `numeric(2,1)` — dormente, conforme a ORDEM DE REMOÇÃO de D-11.
> - **E-3 (cabeçalho anti-recursão)** não foi afetado — a seção do contrato segue no arquivo, agora acompanhada da nota de emenda.
>
> T1 continua **Concluída**: o que ela entregou de fato (colunas, GRANTs, helper, policies) está intacto e reverificado.

---

### T2: RPCs `create_review_with_book`/`update_review_with_book` + helper de slug + regen de tipos — **CONCLUÍDA (2026-08-25)**

> **A migration virou `0011_reviews_crud_rpcs.sql`, não "0009 parte B".** Quando esta task foi escrita, a 0009 ainda era editável; ela e a 0010 **já estão aplicadas em produção**, e migration aplicada não se reescreve. Arquivo novo é a consequência correta do cronograma, não desvio de design.

**What**: Completar `0009_reviews_crud.sql` (design §3–§4, **exatamente** como especificado) com **ambos** os RPCs `SECURITY INVOKER` — `create_review_with_book` (exercido pelo app esta sprint) **e** `update_review_with_book` (criado e provisionado, **não** exercido — a 0009 fica íntegra mesmo com a rota de edição cortada) — e o helper `unique_review_slug` (`security definer`, lê todos os slugs, backstop UNIQUE). `search_path = ''` em **todas** as funções da migration (padronizado — nenhuma diverge). Regenerar `database.types.ts` após o `db reset` (DD-16).
**Where**: ~~`supabase/migrations/0009_reviews_crud.sql` (continuação)~~ → **`supabase/migrations/0011_reviews_crud_rpcs.sql` (novo)** · `src/lib/database.types.ts` (regenerado)
**Depends on**: T1 (RPC insere em `book`/`review` sob as policies daquela parte; mesmo arquivo)
**Reuses**: padrão `SECURITY INVOKER` já justificado no design (D-09 — RLS continua o gate); geração de tipos já usada pós-0006
**Requirement**: REV-02, REV-03, REV-04, REV-05, REV-23, DD-5, DD-6, DD-7, DD-16
**Model**: **Opus** (RPC transacional + segurança de `search_path`)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `npx supabase db reset` local verde — **2× consecutivos, ambos `EXIT=0`** (0001→0011 completa)
- [x] `pg_proc` confirma: `create_review_with_book`/`update_review_with_book` com `prosecdef = f` (**INVOKER**), `unique_review_slug` com `prosecdef = t` (**DEFINER**), as três com `proconfig = {search_path=""}` e `proacl = {postgres=X,authenticated=X}` — **`anon` ausente**
- [x] `database.types.ts` regenerado — inclui as três funções em `Functions` com as assinaturas corretas (sem `p_rating`, D-11); `typecheck` verde
- [x] Gate **quick** verde (typecheck/lint/format/**231 testes**)
- [x] **Atomicidade PROVADA** (REV-04): falha injetada no INSERT de `review` **depois** do de `book` → `ERROR: new row for relation "review" violates check constraint "review_further_reading_is_array"` → `ROLLBACK`; contagens 6/6 inalteradas e **zero book órfão** (oráculo superuser).
- [x] **Isolamento RLS PROVADO**: (a) o RPC usa sempre `auth.uid()` — não há parâmetro de personificação; (b) INSERT direto forjando `editor_id` de outro editor → `new row violates row-level security policy`; (c) editor B editando resenha de A → `42501`, com a resenha de A **intacta** pelo oráculo superuser; (d) `anon` → `permission denied for function`.
- [x] **Slug** verificado: base já usada → `-2`, `-3`; base vazia → fallback `resenha`.

**Tests**: integration (rollback na T4; aqui: reset + inspeção `pg_proc`) · **Gate**: integration (local) + quick
**Verify**: `npx supabase db reset`; `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`; `npm run typecheck`.
**Commit**: `feat(db): 0011 — RPCs atômicos create/update_review_with_book + slug único (REV-02/03/04/05/23)`

> **⚠️ A `0011` NÃO foi aplicada em produção — aguarda `db push` humano (A-11).**
>
> **Desvio do design registrado:** `unique_review_slug` é `volatile`, não `stable`, porque toma um lock consultivo de transação — e lock é efeito colateral. Ver cabeçalho da 0011 para a análise de concorrência e seu limite honesto (a garantia vale sob READ COMMITTED; o UNIQUE segue como backstop).
>
> **T4 (rollback atômico, A-9) ganhou injetor de falha:** o `p_rating` fora de faixa morreu com D-11; o substituto é `p_further_reading` não-array, violando `review_further_reading_is_array` — exercitado nesta task e pronto para virar suíte.

---

### T3: Matriz RLS de `book` — INSERT/UPDATE/DELETE por papel [P com T2] — **CONCLUÍDA (2026-08-25)**

**What**: Suíte integration local-only análoga à `rbac-matrix.integration.test.ts` (0007/0008), agora para `book`: **editor ativo** → INSERT ok; UPDATE só do `book` cuja `review` é dele (`owns_book_via_review`), UPDATE de book de outro editor → nega; **admin** → UPDATE de qualquer book; DELETE → **admin-only** (editor não-admin nega mesmo sendo dono); **`authenticated` sem linha `editor`/inativo** → tudo nega (herdado do 0007); **anon** → toda escrita nega (sem GRANT). `book_public_read` (SELECT anon) segue permitindo em paralelo (SEC-13, não regride).
**Where**: `src/lib/supabase/__tests__/book-rbac-matrix.integration.test.ts` (novo)
**Depends on**: T1 (policies + helper)
**Reuses**: padrão TD-02 completo de `rbac-matrix.integration.test.ts` (setup de usuários via API admin local, cleanup idempotente); lição de oráculo (ler estado real via `psql`/superuser, nunca pelo role sob teste)
**Requirement**: REV-07-schema, DD-4
**Model**: **Opus** (cada célula é uma afirmação de segurança)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] **Todas as 12 células batem o esperado.** Operações via API (PostgREST) com sessões autenticadas reais — o caminho de produção, não `set role`. Saída: `Test Files 1 passed (1) · Tests 12 passed (12)`. Matriz medida:

| Operação | Papel / alvo | Esperado | Observado (oráculo superuser) |
| --- | --- | --- | --- |
| INSERT | editor ativo | PERMITIDO | `error = null`; oráculo `count = 1` |
| INSERT | anon | NEGADO | erro; oráculo `count = 0` |
| UPDATE | editor A → book da PRÓPRIA review | PERMITIDO | `UPDATE 1`; oráculo `title = 'EDITADO POR A'` |
| UPDATE | editor A → book da review de B | NEGADO | `UPDATE 0`; oráculo `title = 'ORIGINAL'` (intacto) |
| UPDATE | editor A → book ÓRFÃO | **NEGADO** | `UPDATE 0`; oráculo `title = 'ORIGINAL'`; `owns_book_via_review = f` |
| UPDATE | admin → book de qualquer editor | PERMITIDO | oráculo `title = 'RLS book editado por admin'` |
| UPDATE | anon | NEGADO | `ERROR: permission denied for table book` (GRANT, não policy); oráculo intacto |
| DELETE | admin | PERMITIDO | `DELETE 1`; oráculo book `0`, review `0` (cascata da FK) |
| DELETE | editor não-admin, book PRÓPRIO | NEGADO | `DELETE 0`; oráculo book `1`, review `1` |
| DELETE | anon | NEGADO | negado; oráculo `count = 1` |
| SELECT | anon | PERMITIDO | `book_public_read` (0003) intacta ao lado das novas |
| RPC | `create_review_with_book` → autor edita, outro editor não | PERMITIDO / NEGADO | oráculo: `editor_id` = A; autor edita; B → `0 linhas` e título preservado |

- [x] **PROVA DE VERMELHIDÃO — a suíte é load-bearing, não falso-verde.** `book_editor_update` foi trocada por `using (true) with check (true)` **no banco local** (experimento revertido por `db reset`; **nenhuma migração tocada**) e a suíte reprovou **exatamente** nas 3 células que dependem dela: `3 failed | 9 passed (12)` — "A não edita book de B", "A não edita book órfão" e a célula do RPC. Com a policy real de volta: `12 passed`.
- [x] **Todo estado lido por `psql -U postgres` (superuser)**, nunca pelo papel sob teste. É o que separa "a RLS negou" de "a linha não existe" — sem isso, todo teste de negação passaria por falso-verde. As operações rodam pelo papel real; só a leitura da verdade é privilegiada.
- [x] **CI PULA** (`describe.skipIf(!RUN)`): a suíte completa sem a flag fecha `30 passed | 6 skipped (36)` / `231 passed | 48 skipped (279)` — as 12 células entram como skipped. **Local verde** com `RUN_RLS_INTEGRATION=1`.
- [x] **VEREDITO TD-02 — o CI NÃO CONSEGUE rodar esta suíte hoje.** Verificado em `.github/workflows/ci.yml`: o job `test` é `ubuntu-latest` + `npm ci` + `npm test`, **sem `services:`, sem stack Supabase, sem container `supabase_db_lia` e sem `RUN_RLS_INTEGRATION`**. Faltam as três coisas ao mesmo tempo: o banco, o `docker exec` do oráculo e a flag. **Nenhum workaround foi tentado, e nenhum mock de RLS foi escrito** — mock de policy não prova policy, só produz falsa segurança sobre a única camada que separa editores. Habilitar exige subir Supabase no CI e mover a suíte para os required checks: é o gatilho já registrado da TD-02 (**antes da entrada do 2º editor real**), e continua valendo.
- [x] Gate **integration** (12/12 local) + **quick** verde (typecheck/lint/format/231 testes)
- [ ] ~~**Residual registrado (achado de 2026-08-12):** o stack local tem `ALTER DEFAULT PRIVILEGES` pré-existente concedendo GRANTs amplos (INSERT/UPDATE/DELETE) a `anon` em toda tabela nova do `public` (...) A verificação de que `anon` **não recebe GRANT nenhum** é **produção-only**~~ — **RETIRADO. Alegação REFUTADA por medição em 2026-08-24 (ver T1, evidência E-6).** O default ACL aplicável às tabelas criadas por `postgres` concede a `anon` só `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), **não** `awd` (INSERT/UPDATE/DELETE); nenhuma tabela do `public` dá escrita a `anon` no stack local. **Consequência para esta matriz:** a ausência de GRANT de escrita a `anon` **É verificável localmente** e deve ser asserção desta suíte, não item de checklist de produção. A verificação em produção segue valendo como confirmação pós-`db push`, mas não é mais o único lugar onde isso pode ser provado. **Achado lateral herdado de E-6:** `anon` tem `TRUNCATE` em todas as tabelas do `public` (default ACL, não migration) — TRUNCATE ignora RLS, hoje inalcançável pelo Data API; revogar é decisão de arquitetura em aberto

**Tests**: integration · **Gate**: integration (local)
**Verify**: `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/supabase/__tests__/book-rbac-matrix.integration.test.ts`.

> **⚠️ DEPENDÊNCIA FRÁGIL A AMARRAR — o injetor de falha do T4.** O teste de rollback atômico (A-9/REV-04) força a `review` a falhar passando `p_further_reading` não-array, violando o CHECK **`review_further_reading_is_array`** (0009). Esse CHECK é hoje a ÚNICA coisa que faz o INSERT de `review` falhar **depois** do de `book` dentro do RPC. **Se ele for removido** — por exemplo se `further_reading` for repensada quando a feature de "para saber mais" voltar (REV-12, diferido) — o teste de atomicidade **passa sem provar nada**: nada falha, o rollback nunca é exercitado, e o verde vira decorativo. O injetor anterior (`p_rating` fora de faixa) já morreu assim, com D-11. **Quem mexer nesse CHECK precisa trocar o injetor no mesmo commit;** candidatos remanescentes: FK de `book.genre_id`, UNIQUE de `review.book_id`, UNIQUE de `review.slug`.
**Commit**: `test(db): matriz RLS de book — own-or-admin transitivo via review (REV-07-schema)`

---

### T4: Rollback/atomicidade dos RPCs (A-9) — task própria — **CONCLUÍDA (2026-08-25)**

**What**: Suíte integration local-only, **exclusivamente** sobre a garantia de atomicidade (REV-04): (a) confirmar que `.rpc()` sob JWT `authenticated` propaga `auth.uid()` dentro da função INVOKER (não fabricar — provar); (b) forçar a `review` a falhar **dentro** da transação → **nenhuma linha em `book`** deve persistir (rollback completo); **⚠️ o injetor de falha original (`p_rating` fora de 0–5, violando o CHECK da T1) DEIXOU DE EXISTIR com D-11** — o CHECK saiu da 0009 e `p_rating` saiu do contrato do RPC. **É preciso escolher outro injetor antes de implementar esta task**; candidatos dentro da mesma transação: violar o CHECK `review_further_reading_is_array` (passando `p_further_reading` que não seja array), violar a FK `book.genre_id`, ou violar o UNIQUE de `review.book_id`. A escolha é decisão de design, não mecânica — **não presumir**; (c) sucesso → `book` **e** `review` presentes, ligados por `book_id`, na mesma consulta pós-commit. **Este é o teste que decide o gatilho do Plano de Corte** (ver seção própria) — não pode ser dobrado com T3 nem com nenhuma outra suíte.
**Where**: `src/lib/supabase/__tests__/create-review-rollback.integration.test.ts` (novo)
**Depends on**: T1, T2
**Reuses**: padrão TD-02; `create_review_with_book` (T2)
**Requirement**: REV-04, A-9
**Model**: **Opus** (é a prova central da atomicidade — maior risco da feature, design §3)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] **Caso de sucesso (create):** `book` e `review` persistidos e ligados. Oráculo: `count(book where id=<novo>) = 1`; `select book_id from review where id=<nova>` = o book criado; delta da marca `+1 book / +1 review`, `orfaos = 0`.
- [x] **Caso de sucesso (update):** as duas tabelas mudam juntas — oráculo confirma título novo em `book` E em `review`, `status = published` e `published_at is not null` (carimbo da 1ª publicação, coalesce da 0011).
- [x] **Caso de falha (create) — injetor DEFINIDO: `p_further_reading` não-array, violando o CHECK `review_further_reading_is_array`** (dispara no INSERT de `review`, depois do de `book` — exatamente a janela do órfão). Resultado: a chamada **falha** (`new row for relation "review" violates check constraint "review_further_reading_is_array"` → `ROLLBACK`), **zero** book com o título da tentativa, **zero** review da marca, e **zero órfão**. Oráculo `psql` superuser.
- [x] **Caso de falha (update):** snapshot **campo a campo** antes e depois — `title|author|publisher|publication_city|year` do `book` e `title|body|status|published_at` da `review` **idênticos**. Contagem não bastaria: o risco do update não é linha a mais, é a ficha do livro ficar alterada com a resenha intacta (o RPC atualiza `book` PRIMEIRO). Confirmado ainda que `status` continua `draft` e `published_at` continua nulo — o carimbo de publicação não vazou.
- [x] **PROVA DE VERMELHIDÃO** (mesmo padrão do T3): os dois RPCs foram substituídos **no banco local** por versões NÃO-ATÔMICAS — o erro do INSERT/UPDATE de `review` engolido num subbloco `exception when others then return null`, de modo que a escrita em `book`, fora do bloco, sobrevive e a transação externa commita. Experimento revertido por `db reset`; **a 0011 não foi tocada**. Resultado: `2 failed | 2 passed (4)` — os casos NEGATIVOS reprovaram, os POSITIVOS seguiram verdes (a versão quebrada funciona no caminho feliz, que é justamente o que torna o teste discriminante). Demonstração direta do órfão pelo oráculo: `orfaos 0 → 1`, com `ORFAO DA PROVA DE VERMELHIDAO` persistido e o RPC devolvendo `null` **sem erro**. Com a 0011 real de volta, a mesma chamada dá `ROLLBACK` e `orfaos = 0`.
- [x] **`auth.uid()` dentro do RPC resolve o editor chamador:** oráculo lê `review.editor_id` = o uid da sessão de teste e `reviewer_name` = `'Atomicity A'` (denormalizado da self-read). Se falhasse, ou a sessão não estaria propagando ou a função teria virado DEFINER — e o dono da resenha deixaria de ser quem a escreveu.
- [x] Gate **integration** (4/4 local) + **quick** verde. Suíte completa sem a flag: **`231 passed | 52 skipped (283)`** — as 4 células entram como skipped (eram 48 após o T3).
- [x] **CI: mesma restrição do T3 (TD-02).** O job `test` não tem stack Supabase, container do oráculo nem `RUN_RLS_INTEGRATION`. **Nenhum mock de transação foi escrito** — mock de transação prova ainda menos que mock de policy: a atomicidade É a transação, então simulá-la é afirmar a conclusão.
- [x] **Resultado: VERDE** (4/4). *(O gatilho do Plano de Corte que este resultado alimentaria está **suspenso** desde 2026-08-24 — ver nota no Plano de Corte; registrado mesmo assim.)*

**Tests**: integration · **Gate**: integration (local)
**Verify**: `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/supabase/__tests__/create-review-rollback.integration.test.ts`.
**Commit**: `test(db): atomicidade de create/update_review_with_book (T4)`

> **⚠️ O AVISO SOBRE O INJETOR VIVE NO PRÓPRIO ARQUIVO DE TESTE**, no cabeçalho, não só aqui — quem for mexer no CHECK `review_further_reading_is_array` precisa ver o problema onde está mexendo. Se o CHECK sair, esta suíte passa sem provar nada: nada falha, o rollback nunca é exercitado, o verde vira decorativo. Já aconteceu uma vez (o injetor anterior era `p_rating` contra `review_rating_integer`; D-11 matou os dois).

---

### T5: `reviewInputSchema` (Zod draft/publish) + `slugify` [P, independente do banco] — **CONCLUÍDA (2026-08-25)**

**What**: `src/lib/review/schema.ts` — estende `bookInputSchema` (ficha) com os campos de resenha (design §5.3): `publicationCity`, `reviewTitle` (default = título do livro), `body`, ~~`rating`~~ **(removido — D-11)**, `tagsInput`/`keywordsInput` como **string única separada por vírgula** transformada em `text[]` (`.transform(s => s.split(',').map(t => t.trim()).filter(Boolean))` — corte de escopo, sem chips), `highlightQuote`, `coverUrl` (`http`/`https` só — A-4). Exporta `reviewDraftSchema` (mínimo estrutural) e `reviewPublishSchema` (`.superRefine` exigindo `body`+ficha completa — tabela do design §5.4; **a nota saiu da lista de obrigatórios, D-11**). Exporta também `reviewStatusSchema = z.enum(['draft','published'])` (usado pelo T6 para decidir qual schema aplicar — **não** vive dentro do action). `src/lib/review/slug.ts` — `slugify(title)`: minúsculas, sem acento, hífens (puro, testável).
**Where**: `src/lib/review/schema.ts` + `src/lib/review/__tests__/schema.test.ts` (novos) · `src/lib/review/slug.ts` + `src/lib/review/__tests__/slug.test.ts` (novos)
**Depends on**: None
**Reuses**: `bookInputSchema` + `isbn.ts` (checksum já embutido)
**Requirement**: REV-06, REV-07, REV-08, REV-09, REV-10, REV-11, REV-13, REV-14, REV-15, REV-16, REV-20, DD-9
**Model**: **Sonnet** (composição mecânica de Zod sobre schema existente)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `reviewDraftSchema`: só a ficha obrigatória (title/author/genreId); o resto opcional — rascunho mínimo aceito
- [x] `reviewPublishSchema`: rejeita ausência de `body` com erro NO CAMPO; aceita quando completo. É gate de **produto** (o banco tem `body` nullable), por isso vive só no publish
- [x] Transform de `tagsInput`/`keywordsInput`: `" ficção , clássico ,, "` → `['ficção','clássico']`; string vazia → `[]`, **nunca** `[""]` nem null (colunas são `NOT NULL DEFAULT '{}'`)
- [x] ~~`rating` não-inteiro ou fora de 0–5~~ **SEM OBJETO** — coluna dropada pela 0010 (D-11)
- [x] `coverUrl` com `javascript:`/`data:`/`ftp:`/sem esquema → rejeitado (A-4)
- [x] `slugify('Dom Casmurro, 50 anos!')` → slug ascii/hífen determinístico; acentos cobertos (`Ação e Coração` → `acao-e-coracao`, `ÇÃO` → `cao`)
- [x] Gate **quick** verde. Suíte: **`281 passed | 52 skipped (333)`** (+50 desta task)

**ESPELHAMENTO BANCO → SCHEMA (um teste por constraint):**

| Constraint (origem) | Espelhado como | Teste |
| --- | --- | --- |
| `book.title/author NOT NULL` (0001) | `.min(1)` | rejeita `''` e `'   '` |
| `book.genre_id NOT NULL` (0002) | `z.uuid()` obrigatório | rejeita ausência e não-uuid |
| `book_year_sane`: null OR 1..2100 (0002) | opcional, 1..anoAtual | rejeita 0, negativo e ano futuro |
| `book_pages_positive`: null OR > 0 (0002) | `.positive()` | rejeita 0 e −1 |
| `book_translation_consistent` (0002) | superRefine herdado | tradutor sem idioma → rejeitado |
| `review_further_reading_is_array` (0009) | `z.array(...)` | rejeita objeto, string e número |
| `review.tags/keywords NOT NULL DEFAULT {}` (0009) | `.default([])` | ausente → `[]` |
| `review.title NOT NULL` (0001) | **derivação** do título do livro | saída nunca vazia |
| ISBN (sem CHECK — 0002 delega à app) | checksum no Zod | rejeita checksum inválido |
| `cover_url` (sem CHECK) | http/https (A-4) | rejeita `javascript:`/`data:` |

**MAIS ESTRITO QUE O BANCO, de propósito:** `year` (teto = ano atual; banco aceita até 2100) e `coverUrl`. Estrito demais nunca vira 500 — só recusa antes; o perigo é o inverso.

**FRICÇÃO DE TIPOS RESOLVIDA (sinalizada no T3):** `toCreateReviewRpcArgs()` devolve os args já no tipo que o `.rpc()` exige, então **o T6 não precisa de cast nenhum**. Internamente o objeto é montado e checado como `CreateReviewRpcArgs`, um tipo DERIVADO do gerado que corrige a nullability **apenas** nos parâmetros de coluna nullable (`p_author` e `p_book_title` seguem não-nulos — afrouxá-los trocaria erro de compilação por 500). A única asserção do módulo está nesse ponto, documentada. **Alarme verificado por experimento:** renomeando um parâmetro no objeto montado, o typecheck falha com `'p_slug_base_RENOMEADO' does not exist in type 'CreateReviewRpcArgs'` — divergência de assinatura continua quebrando o build; só a nullability foi silenciada, e apenas onde se provou que ela mente (o RPC aceita NULL — conferido no banco).

**`slugify` — casos de borda (decididos e testados):** título vazio, só espaços e só símbolos devolvem **`''`**, não um fallback. O fallback `'resenha'` já existe no `unique_review_slug` (0011); duplicar a constante criaria dois lugares para mudá-la. Título longo é truncado em `MAX_SLUG_BASE_LENGTH = 80` sem deixar hífen na borda — decisão de **aplicação** (o banco não limita `slug`), para não gerar URL hostil e deixar folga ao sufixo `-2` do banco. Há teste travando que `slugify` **não** inventa fallback.

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/review/__tests__/schema.test.ts src/lib/review/__tests__/slug.test.ts`.
**Commit**: `feat(review): reviewInputSchema draft/publish + slugify — sem chips, tags/keywords por vírgula (REV-06..16/20)`

---

### T6: `actions.ts` — `createReview`, `publishReview`, `unpublishReview` (gate de publicação)

**What**: `src/app/admin/(protected)/resenhas/actions.ts` (`'use server'`). Cada action chama `requireEditor()` **antes** de qualquer escrita (SEC-08). `createReview`: parseia `status` do `FormData` com `reviewStatusSchema` **primeiro** (falha → erro genérico, nada persistido); **deriva** o schema (`reviewDraftSchema` × `reviewPublishSchema`) do status **validado**, nunca do botão (§5.2 — a emenda A-1); em sucesso, chama `createAuthenticatedClient().rpc('create_review_with_book', …)` com o **mesmo** status validado como `p_status`; `redirect` para `/admin/resenhas`. `publishReview`/`unpublishReview`: carregam a review, validam (`reviewPublishSchema` no publish), `update` só de `review.status`/`published_at` (`coalesce`, nunca reescreve — E-3); `revalidatePath` das rotas públicas **nas duas direções** (publicar **e** despublicar — E-4, sem isso a despublicação fica cacheada como se seguisse no ar). Erros mapeados por cenário (§9): 42501 → mensagem amigável; 23505 (slug) → "tente novamente"; Zod → `fieldErrors`.
**Where**: `src/app/admin/(protected)/resenhas/actions.ts` + `src/app/admin/(protected)/resenhas/__tests__/actions.test.ts` (novos)
**Depends on**: T2 (RPC), T5 (schemas)
**Reuses**: `requireEditor`/`getAuthenticatedEditor`, `createAuthenticatedClient` — mesmo padrão de `admin/login/actions.ts`
**Requirement**: REV-01 (gate), REV-02, REV-15, REV-16, REV-17, REV-18, REV-22, DD-8, DD-10, A-1 (emenda)
**Model**: **Opus** (é o gate de publicação — a emenda E-2 vive aqui; erro de implementação reabre o furo que a revisão fechou)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] **Teste obrigatório da emenda A-1:** `FormData` com `status=published` e `body` ausente → cai em `reviewPublishSchema`, é **rejeitado**, nada é persistido (não em `reviewDraftSchema`, mesmo request "parecendo" um create qualquer)
- [ ] `status` ausente/forjado fora do enum → erro **antes** de tocar o RPC
- [ ] `publishReview`/`unpublishReview`: `published_at` só carimba na 1ª publicação (`coalesce`); `unpublish` → `revalidatePath` disparado (asserção de chamada, não só o status)
- [ ] Sem `requireEditor()` ok → nenhuma escrita ocorre (unit com client/gate stub)
- [ ] Erros 42501/23505 mapeados para mensagem amigável (sem stack) nos testes
- [ ] Gate **quick**

**Tests**: unit (client/gate stub, padrão `requireEditor.test.ts`) · **Gate**: quick
**Verify**: `npx vitest run src/app/admin/\(protected\)/resenhas/__tests__/actions.test.ts`.
**Commit**: `feat(review): actions create/publish/unpublish — schema pelo status validado, revalidatePath nas 2 direções (REV-01/02/15-18/22, A-1)`

---

### T7: `adminQueries.ts` — `listEditorReviews()` [P com T6]

**What**: `src/lib/review/adminQueries.ts`: `listEditorReviews()` via `createAuthenticatedClient()` — sob RLS own-or-admin (0008), retorna as resenhas do editor logado (admin vê todas), rascunhos + publicadas, campos mínimos para a lista (título, slug, status, livro). **Não** inclui `getEditorReviewForEdit` (edição diferida — ver Diferidos).
**Where**: `src/lib/review/adminQueries.ts` + `src/lib/review/__tests__/adminQueries.test.ts` (novos)
**Depends on**: T1 (colunas/GRANTs já presentes para o select)
**Reuses**: padrão de injeção de client de `queries.ts` (público) — mesma forma, client diferente
**Requirement**: REV-24, DD-13 (parcial — só a lista, não a leitura de edição)
**Model**: **Sonnet** (select simples sob client já provado)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Unit com client stub: retorna a forma esperada; não vaza campos de outro editor no teste (RLS é responsabilidade do banco — aqui só o contrato)
- [ ] Efeito de RLS (editor só vê próprias, admin vê todas) coberto por integration — **merge-forward declarado para a matriz de `review` já existente (0008)**, não repetida aqui
- [ ] Gate **quick**

**Tests**: unit (+ merge-forward integration existente) · **Gate**: quick
**Verify**: `npx vitest run src/lib/review/__tests__/adminQueries.test.ts`.
**Commit**: `feat(review): listEditorReviews — leitura admin sob RLS own-or-admin (REV-24)`

---

### T8: `ReviewForm` — scaffolding do formulário (client component)

**What**: `src/app/admin/(protected)/resenhas/ReviewForm.tsx` (`'use client'`, `useActionState`). `<fieldset>` por seção (*Ficha bibliográfica*, *Classificação*, *Conteúdo*) com `<legend>`; campos via `Field` (autor, título, cidade, editora, ano, ISBN, gênero-select, corpo, frase de destaque, capa-URL, **tags/keywords como um único input de texto por vírgula** — sem chips, sem `RepeatableLinks` — §13); **sem** campo de "para saber mais" (cortado). Dois botões (`Salvar rascunho`/`Publicar`) que só **diferem no `status` enviado** — a escolha do schema é 100% do servidor (T6), nunca do cliente (§6.3). Resumo de erros em live region presente desde o 1º render; foco movido ao resumo em falha (WCAG 2.4.3/3.3.1); sucesso anunciado em `role="status"`. ~~Slot para `RatingInput` (T9), consumido como componente à parte.~~ **REMOVIDO POR D-11** — não há campo de nota no formulário; T9 não será construída.
**Where**: `src/app/admin/(protected)/resenhas/ReviewForm.tsx` + `__tests__/ReviewForm.test.tsx` (novos)
**Depends on**: T5 (tipos/validação de referência para os campos)
**Reuses**: `Field`/`Button` (M0), padrão `useActionState`+live region de `LoginForm.tsx`
**Requirement**: REV-08, REV-09, REV-10, REV-11, REV-13, REV-14, REV-20, REV-21, REV-22, DD-11, DD-12, A-6
**Model**: **Sonnet** (scaffolding — reuso extenso de `Field`/`Button`, sem lógica de segurança nova)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Todos os campos com `label` associado (via `Field`); tags/keywords como **um** input de texto, não lista dinâmica
- [ ] Resumo de erros existe (vazio) no 1º render; recebe foco (`tabIndex={-1}`) quando a submissão falha
- [ ] Os dois botões enviam `status` diferente e **nada mais** determina o schema no cliente
- [ ] Erros por campo via `Field.error`/`aria-describedby`/`aria-invalid` (sem depender só de cor — WCAG 1.4.1)
- [ ] Gate **quick** (a11y de rota fica na T10, onde a página existe)

**Tests**: unit (Testing Library) · **Gate**: quick
**Verify**: `npx vitest run "src/app/admin/(protected)/resenhas/__tests__/ReviewForm.test.tsx"`.
**Commit**: `feat(review): ReviewForm — fieldsets, tags/keywords por vírgula, botões só mudam status (REV-08..14/20-22, DD-11/12)`

---

### ~~T9: `RatingInput` — nota 0–5 como radiogroup acessível [P com T8] — **CORTÁVEL #2**~~ — **REMOVIDA POR D-11 (2026-08-24)**

> **NÃO EXECUTAR.** [D-11](../../project/DECISIONS.md) retirou a nota do produto, então o componente não tem objeto: não há campo de nota a tornar acessível. **A numeração NÃO foi alterada** — T10..T13 mantêm seus números, e o texto abaixo fica preservado para que as referências cruzadas (mapa requisito→task, Plano de Corte, diagramas de dependência) continuem resolvendo. O `RatingInput` também **não vira** `<input type="number">`: essa era a versão *cortada* da task, e o corte perdeu objeto junto com a task.
>
> Nenhum arquivo novo. `src/components/review/RatingInput.tsx` e seu teste **não serão criados**.

**What**: `src/components/review/RatingInput.tsx`: `<fieldset><legend>Nota (0 a 5)</legend>` + 6 `radio` (0..5), rótulo textual por opção (não estrelas-só — WCAG 1.1.1/1.4.1), operável por setas/teclado, integrado ao `ReviewForm` (T8) e a `reviewInputSchema` (T5). **Se o gatilho do Plano de Corte disparar** (ver seção própria), este componente **não é construído**: o campo de nota vira um `<input type="number" min="0" max="5" step="1">` via o próprio `Field` (reuso direto, zero componente novo) — a validação Zod (T5) já é a mesma nos dois casos, então o corte não muda `reviewInputSchema`.
**Where**: `src/components/review/RatingInput.tsx` + `__tests__/RatingInput.test.tsx` (novos) — **ou, se cortado, nenhum arquivo novo** (campo absorvido em T8 via `Field`)
**Depends on**: T5 (contrato de valor — inteiro 0–5)
**Reuses**: — (componente novo; ou `Field` puro, se cortado)
**Requirement**: REV-07 (entrada acessível), REV-21, DD-11
**Model**: **Opus** (componente de a11y customizado — radiogroup, navegação por teclado, rótulo textual — carga de a11y explícita na alocação)

**Tools**: MCP: NONE · Skill: NONE

**Done when** (versão completa):
- [ ] `fieldset`/`legend` presentes; 6 opções com rótulo textual (não só ícone/estrela)
- [ ] Navegação por setas entre opções (padrão nativo de radiogroup); seleção refletida no valor do form
- [ ] `aria-invalid`/erro do grupo quando ausente no gate de publicação
- [ ] Gate **quick**

**Done when** (versão cortada — `<input type="number">` via `Field`):
- [ ] `Field` com `type="number"`, `min={0}` `max={5}` `step={1}`, label "Nota (0 a 5)" explícito
- [ ] Erro de fora-de-faixa/decimal via `Field.error` (mesmo padrão dos outros campos)
- [ ] Gate **quick**

**Tests**: unit (Testing Library) · **Gate**: quick
**Verify**: `npx vitest run src/components/review/__tests__/RatingInput.test.tsx` (se construído) — ou o teste de `ReviewForm` cobre o `<input type="number">` (se cortado).
**Commit**: `feat(review): RatingInput radiogroup acessível (REV-07/21)` — ou, se cortado: `feat(review): nota via input number no ReviewForm (corte #2, REV-07/21)`

---

### T10: Rotas `/admin/resenhas` (lista) + `/admin/resenhas/nova` (criar)

**What**: `resenhas/page.tsx` — lista mínima via `listEditorReviews()` (T7): título/status/link para despublicar (**sem** link de editar funcional — a rota de edição está cortada; se a UI expuser um link, ele **não** deve existir esta sprint, para não apontar a 404/rota inexistente). `resenhas/nova/page.tsx` — renderiza `ReviewForm` (T8+T9) ligado a `createReview` (T6). Ambas sob `(protected)` — herdam o gate autoritativo (`requireEditor()`), satisfazendo REV-01 **por reuso**, sem lógica de gate nova aqui. `metadata.robots: noindex`.
**Where**: `src/app/admin/(protected)/resenhas/page.tsx` + `src/app/admin/(protected)/resenhas/nova/page.tsx` (novos) · specs axe das 2 rotas
**Depends on**: T6, T7, T8, T9
**Reuses**: `(protected)/layout.tsx` (gate); padrão de página server-first de `admin/(protected)/page.tsx`
**Requirement**: REV-01 (por reuso), REV-24, DD-13 (lista + nova; editar fora)
**Model**: **Sonnet** (wiring de rota sobre peças já prontas)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `/admin/resenhas` sem sessão → redirect ao login (herdado do layout, conferência rápida); lista renderiza para editor com sessão
- [ ] `/admin/resenhas/nova` completa o fluxo: preencher, "Salvar rascunho" → aparece na lista como draft; "Publicar" completo → status published
- [ ] Nenhum link para `/admin/resenhas/[id]/editar` na lista (rota não existe esta sprint)
- [ ] Axe das 2 rotas sem violações críticas
- [ ] Gate **full**

**Tests**: unit (wiring) + a11y de rota · **Gate**: full
**Verify**: `npm run test:a11y` (rotas novas); fluxo manual local (criar rascunho → publicar → ver na lista).
**Commit**: `feat(review): rotas /admin/resenhas (lista) e /nova (criar) — REV-01/24, DD-13`

---

### T11: Exibição pública A — resenhista, frase de destaque, cidade de publicação — **CORTÁVEL #1**

**What**: Estender `/resenha/[slug]/page.tsx` (design §7): byline `review.reviewer_name` no `<header>`; `<blockquote>` com `review.highlight_quote` (novo `HighlightQuote`, omitido se vazio — REV-11); linha `publication_city` em `BookDetails`. **Este é o 1º item do Plano de Corte** — se o gatilho disparar (ver seção própria), esta task **não entra** nesta sprint: os dados **já estão gravados** (T1/T2/T6 não mudam), só o render público espera um follow-up.
**Where**: `src/app/resenha/[slug]/page.tsx` · `src/components/book/BookDetails.tsx` · `src/components/review/HighlightQuote.tsx` (novo, se não cortado)
**Depends on**: T1, T2 (colunas/tipos), T6 (dados reais gravados para exercitar)
**Reuses**: `REVIEW_SELECT = '*, book(*, …)'` já traz as colunas por `*` (sem mudança de query — só regen de tipos, já feito na T2)
**Requirement**: REV-11, REV-14 (exibição), DD-14 (parcial)
**Model**: **Sonnet** (extensão de exibição sobre componentes existentes)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Byline exibe `reviewer_name` quando presente
- [ ] `highlight_quote` renderiza com realce quando preenchido; **omitido** (sem placeholder) quando vazio
- [ ] `publication_city` aparece em `BookDetails` quando presente
- [ ] Axe da rota `/resenha/[slug]` sem violações críticas (regressão + campos novos)
- [ ] Gate **full**

**Tests**: unit (render condicional) + a11y de rota · **Gate**: full
**Verify**: `npm run test:a11y` na rota; conferência visual com uma resenha publicada via T10.
**Commit**: `feat(review): exibição pública de reviewer_name/highlight_quote/publication_city (REV-11/14)`

---

### T12: Exibição pública B — tags e palavras-chave [P com T11]

**What**: Estender `/resenha/[slug]/page.tsx`: lista de tags exibida (REV-08, **sem** filtro/link — TAGS=c, adiado); `keywords` entram em `generateMetadata` como `keywords` (SEO, REV-09), **não** como filtro nem UI visível. **Não é cortável** — ao contrário da T11, o Plano de Corte não toca aqui (tags/keywords não estão na lista de campos cortáveis).
**Where**: `src/app/resenha/[slug]/page.tsx` (mesma extensão da T11, seção distinta)
**Depends on**: T1, T2, T6
**Reuses**: mesmo `REVIEW_SELECT` da T11
**Requirement**: REV-08, REV-09
**Model**: **Sonnet**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Tags exibidas como lista simples (sem link/filtro clicável — TAGS=c)
- [ ] `keywords` presentes em `generateMetadata` da rota (conferível no `<head>` renderizado), ausentes da UI visível
- [ ] Axe da rota sem violações críticas
- [ ] Gate **full**

**Tests**: unit (render + metadata) + a11y de rota · **Gate**: full
**Verify**: `npm run test:a11y`; inspeção do `<head>` gerado (`generateMetadata`).
**Commit**: `feat(review): exibição pública de tags + keywords em metadata (REV-08/09)`

---

### T13: Ensaio final — gate completo + axe + NVDA + checklist de merge

**What**: Rodar o gate **full** completo (quick + `test:a11y`) mais as 4 suítes integration (T3, T4, T3-book-matrix, e a matriz de `review` 0008 herdada) contra a stack local; percorrer manualmente com **NVDA** as rotas novas (`/admin/resenhas`, `/nova`, e a `/resenha/[slug]` estendida): navegação por teclado até o fim, leitura do resumo de erros ao falhar o gate de publicação, leitura do sucesso ao salvar. Preencher o checklist de merge (padrão T19 de `security-foundation`): `pg_policies` local mostra as policies novas de `book`; nenhuma pendência de `db push` esquecida; ordem de rollout (A-11) documentada no PR.
**Where**: — (verificação; ajustes pontuais achados entram no mesmo commit se triviais)
**Depends on**: T1–T12 (todas)
**Reuses**: padrão de UAT de `security-foundation` T19
**Requirement**: success criteria do spec; REV-21 (a11y, verificação final); todas as stories P1
**Model**: **Opus** (julgamento de UAT + a11y real com leitor de tela — não é execução mecânica de comando)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Gate full verde (baseline 192/36 + todos os testes novos desta feature)
- [ ] As 4 suítes integration verdes local; CI seguirá pulando-as (skipIf)
- [ ] Roteiro NVDA sem bloqueio: criar rascunho, tentar publicar incompleto (ouve o resumo de erros), completar, publicar (ouve o sucesso), despublicar
- [ ] `npm run build` compila
- [ ] Checklist de merge preenchido no PR (policies de `book` confirmadas local; STOP do `db push` produção documentado, pós-merge)

**Tests**: e2e manual guiado + suítes existentes · **Gate**: full + integration + build
**Verify**: roteiro acima; contagem final de testes registrada no PR.
**Commit**: `chore(review): ensaio final + gates completos (checklist de merge)` *(se houver ajustes)*

---

## [FORA das tasks] `db push` produção — STOP humano (A-11)

Não é uma task numerada — é o mesmo passo humano pós-merge já usado em M2/D-08. Ordem: **T1–T13 concluídas e mergeadas** → `db push` produção (0009 completa, aditiva) → verificar `pg_policies` em produção (policies de `book` presentes) → ~~**confirmar que a normalização da nota rodou**~~ **SEM OBJETO (D-11)** — a normalização saiu da 0009; a nota de produção permanece **como está**, na coluna dormente → **confirmar que `anon` NÃO tem GRANT de INSERT/UPDATE/DELETE em `book`** (`information_schema.role_table_grants`) — *nota: isto **também** é verificável localmente e já foi verificado (T1, evidência E-6); a conferência em produção vale como confirmação do ambiente real, não como único lugar possível* → smoke test manual (criar/publicar uma resenha real, ver no ar) → seed/dados existentes intactos (4 resenhas antigas continuam publicadas). **Sem `SUPABASE_SERVICE_ROLE_KEY` em Production** (gate herdado, SEC-17) — a 0009 não muda esse gate.

---

## Diferidos

Requisitos do spec **conscientemente não cobertos** por nenhuma task acima — estado **correto**, não órfão. Motivo: corte de escopo do Design (§13), decisão já aprovada em 2026-08-09, não desta fase.

| Requisito | Por que está fora | Quando volta |
| --- | --- | --- |
| **REV-12** (para saber mais — `further_reading`) | `RepeatableLinks` não construído (componente mais caro do design — lista dinâmica, foco gerido, Zod por item, filtro XSS, `<nav>` público) | Feature futura; **coluna `jsonb` + CHECK já existem na 0009** (T1) — schema não muda quando voltar |
| **REV-19** (editar resenha existente sob RLS own-or-admin) | `update_review_with_book` **criado** na T2 mas **não exercido**; rota `/admin/resenhas/[id]/editar` fora do Execute | Feature de edição, follow-up. RPC e policies de UPDATE de `book` já prontos (T1/T2) — só faltam `updateReview` (action), `getEditorReviewForEdit` (query) e a rota |
| **DD-13 (parte)** — `getEditorReviewForEdit(id)` | Consequência direta do REV-19 diferido — não há tela de edição para popular | Junto com REV-19 |

| **REV-07** (nota inteira 0–5) | **REMOVIDO do produto por [D-11](../../project/DECISIONS.md)** (2026-08-24), não diferido — a nota não volta. T9 removida; T5/T8/T11/T12 encolhidas | **Nunca.** Requisito extinto, não adiado |

### ~~PENDÊNCIA DE REGRESSÃO DO M1~~ — **EXECUTADA em 2026-08-24**

> **A ORDEM DE REMOÇÃO de D-11 foi COLAPSADA por decisão do responsável** (emenda registrada em [DECISIONS.md](../../project/DECISIONS.md)). Os passos 2, 3 e 4 executaram **juntos**, nesta leva. Isto deixou de ser pendência futura.

**O que foi feito:**

| Onde | O que saiu | Arquivo |
| --- | --- | --- |
| Filtro "nota mínima" | `query.gte('rating', …)` removido | `src/lib/review/queries.ts` |
| Ordenação "Melhor nota" | opção `nota` fora de `SortOrder`/`SORT_ORDERS`/`SORT_LABELS` | `queries.ts`, `listingParams.ts`, `ListingControls.tsx` |
| Param `nota` | parse/clamp/serialização removidos | `src/lib/review/listingParams.ts` |
| Select de nota | `<select name="nota">` + `MIN_RATINGS` removidos | `src/components/listing/ListingControls.tsx` |
| Eco no estado vazio | `nota mínima N` removido | `src/components/listing/EmptyState.tsx` |
| Exibição | `<Rating />` fora de card, carrossel, home e página | `ReviewCard.tsx`, `FeaturedCarousel.tsx`, `page.tsx`, `resenha/[slug]/page.tsx` |
| Componente e formatador | **arquivos deletados** | `Rating.tsx`, `formatRating.ts` |
| Testes dos módulos deletados | **arquivos deletados** | `Rating.test.tsx`, `formatRating.test.ts` |
| Coluna no banco | `alter table public.review drop column if exists rating` | **`0010_drop_review_rating.sql`** (nova) |
| Seed | `rating` fora do INSERT + comentário falso sobre o CHECK corrigido | `supabase/seed.sql` |
| Tipos gerados | `rating` some; colunas da 0009 entram (arquivo estava defasado) | `src/lib/database.types.ts` |

**Decisões tomadas na execução, para revisão:**

- **Ordenação default NÃO mudou.** O default já era `recentes` (`published_at` desc, nulls last) — nunca foi `nota`. Restam **duas** opções: `recentes` (default) e `titulo`. Não houve necessidade de eleger um novo default.
- **`ListingControls` continua justificado.** Perdeu um de cinco controles; seguem busca por título, filtro de gênero, filtro de autor e ordenação. **Não** ficou vazio.
- **URLs legadas degradam sem erro.** `?nota=4` e `?ordem=nota` são ignorados: `parseListingParams` só lê as chaves que conhece e `ordem` fora do conjunto cai no default. Coberto por teste em `listingParams.test.ts` e `listing.integration.test.ts`.
- **`ReviewCard.test.tsx` e `FeaturedCarousel.test.tsx` NÃO foram deletados**, apenas ajustados — cobrem componentes que sobrevivem; deletá-los seria perda de cobertura, não limpeza.

**Estado conhecido e temporário:** a home perdeu o filtro por nota e a ordenação por nota. **Não** ficou sem filtro — mantém busca, gênero e autor. O filtro por deficiência representada (D-12) segue bloqueado pelo vocabulário inicial `[PREENCHER]`.

**⚠️ A `0010` NÃO foi aplicada em produção.** `db push` é passo humano (A-11).

**Nenhum outro requisito (REV-01..24 + REV-07-schema) fica sem task.** REV-08/REV-09 (tags/keywords) **não** estão diferidos — são T12, cobertos integralmente, inclusive exibição.

---

## Mapa requisito → task

Tabela explícita (a versão condensada no final da Validação repete o mesmo mapeamento em prosa) — todo REV-* aparece aqui, inclusive os diferidos.

| Requisito | Task(s) | Nota |
| --- | --- | --- |
| REV-01 | T10 | por reuso do gate `(protected)`, sem lógica nova |
| REV-02 | T2, T6 | |
| REV-03 | T2 | |
| REV-04 | T2, **T4** | T4 = teste de rollback, task própria (A-9) |
| REV-05 | T2 | |
| REV-06 | T1, T5 | |
| ~~REV-07~~ | ~~T1, T5, T9~~ | **REQUISITO REMOVIDO POR D-11** — não é diferido, é extinto. T9 removida; T1/T5 encolhidas |
| REV-07-schema | T1, T3 | |
| REV-08 | T5, T8, T12 | |
| REV-09 | T5, T8, T12 | |
| REV-10 | T5, T8 | |
| REV-11 | T5, T8, **T11** | T11 cortável (corte #1) — captura sempre entra, exibição pode atrasar |
| REV-12 | — | **Diferido** (ver Diferidos) |
| REV-13 | T5, T8 | |
| REV-14 | T5, T8, **T11** (parte de exibição) | idem REV-11 |
| REV-15 | T5, T6 | |
| REV-16 | T5, T6 | a emenda A-1 (schema pelo status validado) vive em T6 |
| REV-17 | T6 | |
| REV-18 | T6 | |
| REV-19 | — | **Diferido** (ver Diferidos) |
| REV-20 | T5, T8 | |
| REV-21 | T8, ~~T9~~, T10, T11, T12, **T13** | embutida no "done" de cada uma — T13 é o passo final (NVDA manual + axe agregado), não task de a11y separada |
| REV-22 | T6, T8 | |
| REV-23 | T2, T5 | |
| REV-24 | T7, T10 | |
| ~~D-01~~ → **D-11** | ~~T1~~ | ~~normalização + CHECK~~ — **superseded**: a nota saiu do produto, normalização e CHECK removidos da 0009 |
| A-9 | **T4** | task própria, não item de outra task |

**O que é T13, para não confundir com o `db push` (eles aparecem lado a lado no diagrama do dia 15):** T13 é trabalho de verificação — rodar o gate, as 4 suítes integration, e o roteiro manual com NVDA — feito **pela equipe, antes do merge**. O `db push` é um passo **humano, pós-merge, fora de qualquer task** (seção acima). São coisas diferentes: T13 tem "done when" verificável e produz um commit se achar ajuste; o `db push` não é uma task e não tem "done when" — é um checklist de deploy. T13 mapeia para REV-21 de forma legítima (não inventada): REV-21 exige WCAG 2.1 AA como DoD, e a verificação manual com leitor de tela é parte real desse DoD, não coberta só por `axe` automatizado nas tasks individuais.

---

## Plano de Corte (contingência de cronograma — distinto do corte do Design)

**Por que existe:** o calendário é real (3 dias, ~3h/dia, sem buffer) — este plano decide **o que sai primeiro** se o tempo não fechar, para não haver escolha de última hora sob pressão.

> **NOTA 2026-08-24 — PLANO DE CORTE SUSPENSO**
> Motivo: os gatilhos existiam para proteger a janela 13–15/08, que não foi executada e não tem substituta. Escopo integral mantido. Se um prazo externo reaparecer, os cortes voltam com nova âncora antes do reinício — nunca decididos tarefa a tarefa sob pressão.
> Ressalva: o Corte #2 (T9 → input number) perde objeto se a decisão de remoção da nota for formalizada. **CONFIRMADO em 2026-08-24 — D-11 foi formalizada e T9 REMOVIDA; o Corte #2 está sem objeto.**

### Corte #1 — Exibição pública de `reviewer_name`/`highlight_quote`/`publication_city` (T11)

**O que sai:** só a T11 (a extensão da `review-page`). O schema (T1/T2) e o formulário (T8) **ficam** — os dados continuam sendo capturados e gravados, só não aparecem no público ainda.
**Gatilho:** se, **ao fim do dia 13/08**, o teste de rollback do RPC (T4, A-9) **não estiver verde**, o Corte #1 é **acionado imediatamente, sem reavaliação** — o tempo perdido no dia 13 vem daqui, não de uma escolha nova no dia 15.
**Consequência a registrar:** enquanto T11 não entra, REV-11 e a parte de exibição de REV-14 (`publication_city` visível) ficam **parcialmente atendidos** — captura sim, exibição não. Isso é diferente de REV-12 (Diferidos): aqui a intenção original **não muda**, só atrasa.

### ~~Corte #2 — `RatingInput` dedicado (T9)~~ — **SEM OBJETO (D-11, 2026-08-24)**

> A task que este corte reduzia foi **removida** por D-11, não cortada. Não há o que decidir aqui.

**O que sai:** o componente radiogroup. Substituído por `<input type="number" min="0" max="5" step="1">` via `Field` (reuso direto — T8 absorve o campo, T9 não gera arquivo). A validação Zod (T5) é **a mesma** nos dois casos — cortar T9 não muda `reviewInputSchema`.
**Gatilho:** avaliado no dia 14/08, **depois** do Corte #1 já ter sido decidido no dia 13 — se o dia 14 também apertar, este é o próximo a cair, nessa ordem (nunca o contrário: T11 sempre cai antes de T9, porque T11 depende de dados que T9 não afeta).
**Consequência a registrar:** `<input type="number">` ainda é acessível (label explícito, min/max, validação por Zod, erro via `Field.error`) — **não** é uma regressão de a11y, é uma forma mais simples do mesmo requisito (REV-07/21 continuam atendidos, só sem o padrão radiogroup mais rico).

**O que este plano NÃO corta, em nenhuma circunstância desta janela de 3 dias:** a 0009 (T1/T2), os RPCs, as policies de `book`, o gate de publicação (T6), a captura de qualquer campo no formulário (T8), a exibição de tags/keywords (T12). Esses são o núcleo do MVP (P1 do spec) — se apertarem, o corte é de **prazo do calendário inteiro** (empurrar T13/`db push` para depois do dia 15), não de escopo do núcleo.

---

## Validação pré-aprovação (3 gates do skill)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1–T2 | 1 migration, 2 partes coesas (schema/GRANTs × RPCs/tipos — indivisível sem deixar o arquivo pela metade num commit) | ✅ coeso |
| T3–T4 | 1 suíte integration cada, propósito distinto (matriz de papel × rollback transacional) | ✅ |
| T5 | 2 utilitários puros do mesmo domínio (schema + slugify), sem dependência de banco | ✅ coeso |
| T6 | 3 actions do mesmo fluxo de escrita (create/publish/unpublish compartilham gate e padrão de erro) | ✅ coeso |
| T7 | 1 módulo de leitura | ✅ |
| T8–T9 | 1 componente cada, split deliberado (scaffolding × a11y customizada) para isolar o corte #2 | ✅ |
| T10 | 2 rotas da mesma feature (lista+criar), entrega conjunta natural | ✅ coeso |
| T11–T12 | 1 extensão de página cada, split deliberado (cortável × não-cortável) | ✅ |
| T13 | 1 verificação final | ✅ |

### Check 2 — Diagrama × Depends on

| Task | Body diz | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | início dia 13 | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T1 | T1→T3 [P com T2] | ✅ |
| T4 | T1, T2 | T1,T2→T4 | ✅ |
| T5 | None | [P, independente] | ✅ |
| T6 | T2, T5 | T2,T5→T6 | ✅ |
| T7 | T1 | T1→T7 [P com T6] | ✅ |
| T8 | T5 | T5→T8 | ✅ |
| T9 | T5 | T5→T9 [P com T8] | ✅ |
| T10 | T6,T7,T8,T9 | T6,T7,T8,T9→T10 | ✅ |
| T11 | T1,T2,T6 | T1,T2,T6→T11 | ✅ |
| T12 | T1,T2,T6 | T1,T2,T6→T12 [P com T11] | ✅ |
| T13 | T1–T12 | T1..T12→T13 | ✅ |

### Check 3 — Co-locação de testes × matriz

| Task | Camada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | migration (colunas/CHECK/GRANTs/policies) | integration | integration (+ merge-forward matriz completa → T3) | ✅ |
| T2 | migration (RPCs/helper) | integration | integration (+ merge-forward rollback → T4) | ✅ |
| T3 | policies de book | integration | integration | ✅ |
| T4 | RPC transacional | integration (task própria — A-9) | integration, task própria | ✅ |
| T5 | módulos puros | unit | unit | ✅ |
| T6 | server actions | unit (client/gate stub) | unit | ✅ |
| T7 | leitura autenticada | unit + merge-forward integration (0008 já prova o efeito RLS) | unit + merge-forward declarado | ✅ |
| T8 | componente form | unit | unit | ✅ |
| T9 | componente a11y | unit | unit | ✅ |
| T10 | rotas (SSR wiring) | a11y de rota + build | a11y + build (gate full) | ✅ |
| T11–T12 | extensão de página | a11y de rota | a11y (gate full) | ✅ |
| T13 | verificação | none (é a própria verificação) | e2e manual + suítes existentes | ✅ |

**Cobertura de requisitos: 22/25 cobertos por task nesta sprint (REV-01..11, REV-13..18, REV-20..24, REV-07-schema) + 3 diferidos explicitamente (REV-12, REV-19, e a parte de DD-13 de edição) = 25/25 sem órfão** — REV-01 (T10, por reuso do gate) · REV-02 (T2/T6) · REV-03 (T2) · REV-04 (T2/T4) · REV-05 (T2) · REV-06 (T1/T5) · REV-07 (T1/T5/T9) · REV-07-schema (T1/T3) · REV-08 (T5/T8/T12) · REV-09 (T5/T8/T12) · REV-10 (T5/T8) · REV-11 (T5/T8/**T11 cortável**) · REV-12 (**diferido**) · REV-13 (T5/T8) · REV-14 (T5/T8/**T11 cortável para a parte de exibição**) · REV-15 (T5/T6) · REV-16 (T5/T6) · REV-17 (T6) · REV-18 (T6) · REV-19 (**diferido**) · REV-20 (T5/T8) · REV-21 (T8/T9/T10/T11/T12/T13, embutida) · REV-22 (T6/T8) · REV-23 (T2/T5) · REV-24 (T7/T10).
