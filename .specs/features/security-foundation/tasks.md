# security-foundation — Tasks

**Design**: [design.md](design.md) (DD-1..19, §1–§9) · **Spec**: [spec.md](spec.md) (SEC-01..19) · **Context**: [context.md](context.md) (C-1..C-6)
**Status**: Draft — aguardando revisão antes do Execute

> **Decisões da revisão do design (aprovadas em 2026-07-07):** **A-2** — `anon` fica **sem GRANT** em `editor`/`comment`/`recommendation` (mais estrito que a letra de SEC-12/16; testes aceitam "vazio **ou** 42501" como deny). **A-4** — matriz de `review` **own-or-admin** com editor podendo **publicar a própria** resenha (PRD §4/§6.3); publicação só-admin, se desejada, é decisão da `reviews-crud` (exigiria trigger).
> **STOPs desta feature:** (1) `supabase db push` em **produção** NÃO faz parte destas tasks — migrations 0007/0008 são aplicadas **apenas local** (`db reset`); o push é passo humano pós-merge (design §2.6, A-11). (2) `SUPABASE_SERVICE_ROLE_KEY` **não** entra na Vercel em nenhuma task (SEC-17). (3) SMTP custom + template de e-mail são **configuração de dashboard** documentada no runbook (T17), não executada aqui.
> **a11y WCAG 2.1 AA é DoD embutida** — a única UI é o login (+ tela não-autorizado); as tasks de UI carregam o §6 do design no "Done when".
> **Lição de env em testes (STATE.md):** todo teste que importe a cadeia `queries/clients → env.ts` usa **import dinâmico** no setup. Módulos com `import 'server-only'` exigem o **stub/alias do vitest** (T1) para serem importáveis em teste.

---

## Gate Check Commands

Derivados do CI (lição pós-PR #2: o gate inclui `format:check`). Não existe `.specs/codebase/TESTING.md`; a matriz abaixo segue o precedente firme do repo.

| Nível | Comando | Quando |
| --- | --- | --- |
| **quick** | `npm run typecheck && npm run lint && npm run format:check && npm run test` | toda task de lógica/componente (unit) |
| **full** | quick **+** `npm run test:a11y` | tasks que criam/alteram rota (axe na rota nova) |
| **build** | `npm run build` | provas de compilação/fronteira |
| **integration (local-only, TD-02)** | `npx supabase start && npx supabase db reset` → `$env:RUN_RLS_INTEGRATION='1'; npx vitest run <arquivo>` | policies/GRANTs contra Supabase local; **CI PULA** via `describe.skipIf` |

**Baseline atual:** `155 passed / 16 skipped` (pós-merge PR #3). Todo "Done when" exige baseline verde + novos testes passando (sem deleção silenciosa).

### Matriz de cobertura derivada (precedente do repo)

| Camada criada/modificada | Teste exigido | Precedente |
| --- | --- | --- |
| Função pura / módulo de env (`lib/**`) | **unit** (Vitest, import dinâmico p/ env) | `listingParams.test.ts`, lição env/CI |
| Fábrica de client Supabase | **unit** (contrato/erros) + **integration** local p/ efeito RLS | `rls.integration.test.ts` (TD-02) |
| Componente React (render/semântica/aria) | **unit** (Testing Library) | `Rating.test.tsx` |
| `page.tsx`/`layout.tsx`/route handler (SSR wiring) | **a11y de rota** (axe) + build; lógica extraível → unit | `review-page` (page coberta por axe) |
| Migration SQL (policy/GRANT) | **integration** local-only (matriz por papel) | 0005/0006 + T4 da listing (8/8) |
| Config (eslint/vitest/proxy matcher) | **none** (o próprio gate é a prova) | eslint.config.mjs do M0 |

---

## Execution Plan

### Phase 1 — Fundação de deps + env + client público (sequencial)

```
T1 (deps + stub server-only) ──► T2 (env por client) ──► T3 (public.ts + swap + tripwire)
```

### Phase 2 — Clients restantes + banco local (paralela após T2)

```
T2 ──► T4 (admin.ts + erro explícito) ──► T5 (lint boundary allowlist vazia)
T1,T2 ──► T6 (authenticated.ts)                                    [P]
T1,T2 ──► T7 (proxy.ts refresh/otimista)                           [P]
        T12 (0007 editor RBAC — local) ──► T13 (0008 review write — local)   [P com código]
```

### Phase 3 — Fluxo de auth (paralela após T6)

```
T6 ──► T8  (requireEditor/requireAdmin)
T6 ──► T9  (login /admin/login + action + a11y)   [P]
T6 ──► T10 (/auth/confirm + /auth/signout)        [P]
```

### Phase 4 — Integração do gate

```
T8,T10 ──► T11 (route group (protected): layout + stub + não-autorizado)
```

### Phase 5 — Regressão e provas (sequencial no banco local; T15 é build)

```
T3,T13 ──► T14 (SEC-14 + SEC-16/19: env presente ≠ bypass; deny-by-default)
T12,T13 ──► T16 (matriz RLS por papel)      (T14 → T16 sequencial: mesmo banco local)
T4,T5  ──► T15 (prova única de build boundary)   [P]
```

### Phase 6 — Docs + fechamento

```
T13 ──► T17 (runbook bootstrap + SMTP + gate SEC-17)   [P]
T14,T15,T16 ──► T18 (D-09 em DECISIONS + STATE/ROADMAP: TD-04/TD-03/SEC-18)
tudo ──► T19 (verificação end-to-end local + gate full + checklist de merge)
```

---

## Task Breakdown

### T1: Dependências novas + stub de `server-only` para testes

**What**: Instalar `@supabase/ssr@^0.12.0` e `server-only`; criar stub vazio (`src/test/server-only-stub.ts`) e registrar `resolve.alias: { 'server-only': <stub> }` no [vitest.config.ts](../../../vitest.config.ts) (só no runner — o build usa o pacote real; design §1.5).
**Where**: `package.json` · `package-lock.json` · `vitest.config.ts` · `src/test/server-only-stub.ts` (novo)
**Depends on**: None
**Reuses**: config vitest existente (loadEnv, alias `@`)
**Requirement**: DD-18, C-3 (mecanismo), lição env/testes
**Model**: **Sonnet** (mecânico)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `@supabase/ssr` e `server-only` em `dependencies`; lockfile atualizado
- [ ] Alias ativo: um teste temporário importando módulo com `import 'server-only'` não explode no vitest (removido após conferir) — ou conferência via T2
- [ ] Gate **quick** passa; baseline 155/16 intacto; `npm run build` compila

**Tests**: none (config) · **Gate**: quick + build
**Verify**: `npm ls @supabase/ssr server-only` mostra as versões; build verde.
**Commit**: `chore(deps): adiciona @supabase/ssr e server-only + stub de teste (DD-18)`

---

### T2: Env por client — `env.ts` público puro + `env.admin.ts` lazy

**What**: Reescrever [env.ts](../../../src/lib/env.ts): schema **só** com `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (linha `SUPABASE_SERVICE_ROLE_KEY` **removida**), com `refine` rejeitando prefixo `sb_secret_` na publishable. Criar `env.admin.ts`: `import 'server-only'`, `getAdminEnv()` com parse **lazy** de `SUPABASE_SERVICE_ROLE_KEY` (erro nomeado se ausente; `refine` rejeita prefixo `sb_publishable_`).
**Where**: `src/lib/env.ts` (reescrito) · `src/lib/env.admin.ts` (novo) · `src/lib/__tests__/env.test.ts` (novo)
**Depends on**: T1
**Reuses**: Zod já em uso; padrão de parse do env.ts atual
**Requirement**: SEC-02 (público sem referência), SEC-04 (falha explícita, sem degradação), DD-4; F-3/F-4 do threat model
**Model**: **Fable** (código de segurança: validação de fronteira de credencial)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `env.ts` não contém a string `SERVICE_ROLE` (nem em tipo, nem em comentário de código)
- [ ] Unit tests (import **dinâmico** + `vi.stubEnv`): publishable com `sb_secret_…` → parse falha; `getAdminEnv()` sem a var → lança erro **nomeado** (mensagem cita SEC-04/design); com `sb_publishable_…` → lança; com valor válido → retorna
- [ ] `env.admin.ts` só valida na **chamada** (importá-lo com env vazia não lança — provado no teste, via stub do T1)
- [ ] Gate **quick** passa; baseline + novos verdes

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/__tests__/env.test.ts` verde; `grep -i SERVICE_ROLE src/lib/env.ts` → vazio.
**Commit**: `feat(security): separa env por client — público puro + admin lazy (SEC-02/04)`

---

### T3: `public.ts` + migração dos consumidores + remoção de `server.ts`/`client.ts` + tripwire

**What**: Criar `createPublicClient()` (anon, `persistSession:false`, design §1.4); trocar os imports em [book/queries.ts](../../../src/lib/book/queries.ts) e [review/queries.ts](../../../src/lib/review/queries.ts) (`createServerClient` → `createPublicClient`); **deletar** `server.ts` (fallback `??` morre) e `client.ts` (código morto, A-7). Incluir o **tripwire estático** (T-b do design §5.3): unit test que lê o fonte de `env.ts` + `public.ts` e afirma ausência da string `SERVICE_ROLE` — roda no CI sem banco.
**Where**: `src/lib/supabase/public.ts` (novo) · `src/lib/book/queries.ts` · `src/lib/review/queries.ts` (imports) · `src/lib/supabase/server.ts` + `client.ts` (**deletados**) · `src/lib/supabase/__tests__/no-service-role.test.ts` (novo)
**Depends on**: T2
**Reuses**: assinatura e comportamento do client atual (mesmo `createClient<Database>`; troca só a origem da chave)
**Requirement**: SEC-01, SEC-02, SEC-05 (leituras públicas migram sem mudança), SEC-13, SEC-14 (tripwire), DD-1/2/5, TD-04
**Model**: **Sonnet** (swap mecânico com rede: tripwire + baseline)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `server.ts` e `client.ts` **não existem mais**; nenhum import órfão (`grep createServerClient src/` → só histórico em .specs)
- [ ] Tripwire verde: fonte de `env.ts`/`public.ts` sem `SERVICE_ROLE`
- [ ] Comportamento observável idêntico: baseline 155/16 verde (testes de queries/home/resenha intactos); `npm run build` compila; rotas `/` e `/resenha/[slug]` renderizam no `next dev` (conferência rápida)
- [ ] Gate **quick** + build

**Tests**: unit (tripwire) · **Gate**: quick + build
**Verify**: `npx vitest run src/lib/supabase/__tests__/no-service-role.test.ts`; `npm run build`.
**Commit**: `feat(security): client público sem fallback; remove server.ts/client.ts (SEC-01/02/05, TD-04)`

---

### T4: `admin.ts` — client service_role isolado e dormente

**What**: Criar `createAdminClient()`: `import 'server-only'`; chama `getAdminEnv()` (lazy, T2); `createClient` com a service key e `persistSession:false`; JSDoc citando C-2 (dormência) e a exigência de gate autenticado (SEC-08). Unit test (T-d do design): import dinâmico (stub T1) → sem env lança erro nomeado; com env fake válida retorna client.
**Where**: `src/lib/supabase/admin.ts` (novo) · `src/lib/supabase/__tests__/admin.test.ts` (novo)
**Depends on**: T2
**Reuses**: padrão de fábrica do `public.ts` (T3)
**Requirement**: SEC-01, SEC-03 (server-only), SEC-04, SEC-15(a), DD-1/3/4, C-2
**Model**: **Fable** (módulo mais sensível da feature)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `import 'server-only'` é a **primeira** linha de import
- [ ] Sem `SUPABASE_SERVICE_ROLE_KEY` → erro explícito no **uso** (nunca client anon; nunca no import do módulo)
- [ ] **Nenhum arquivo do app importa `admin.ts`** (dormência — o lint T5 vai congelar isso)
- [ ] Gate **quick**; novos testes verdes

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/supabase/__tests__/admin.test.ts`.
**Commit**: `feat(security): client admin server-only, lazy e dormente (SEC-03/04/15a, C-2)`

---

### T5: Lint boundary — `no-restricted-imports` com allowlist VAZIA

**What**: Adicionar ao [eslint.config.mjs](../../../eslint.config.mjs) a regra proibindo `@/lib/supabase/admin` e `@/lib/env.admin` em `src/**` (mensagem citando C-2/ADR, design §1.3). Sem exceções — a allowlist nasce vazia.
**Where**: `eslint.config.mjs`
**Depends on**: T4
**Reuses**: flat config existente
**Requirement**: SEC-03 (3ª camada), SEC-15(b) parcial, DD-3, C-2/C-3; F-2 do threat model
**Model**: **Sonnet**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Prova negativa executada: arquivo temporário em `src/app/` importando `@/lib/supabase/admin` → `npm run lint` **reprova** com a mensagem da regra; arquivo removido em seguida (não commitado)
- [ ] `npm run lint` verde no repo real (nenhum import existente viola)
- [ ] Gate **quick**

**Tests**: none (config — a prova negativa é a verificação) · **Gate**: quick
**Verify**: prova negativa acima + lint verde.
**Commit**: `feat(security): lint boundary de import do admin com allowlist vazia (SEC-03, C-2)`

---

### T6: `authenticated.ts` — client do editor via `@supabase/ssr` [P]

**What**: Criar `createAuthenticatedClient()`: `import 'server-only'`; `createServerClient` do `@supabase/ssr` com env pública + adaptador de cookies de `next/headers` (padrão `getAll`/`setAll` da doc 0.12 — **verificar API real na lib instalada, não fabricar**); JSDoc: RLS é o gate, papel `authenticated`.
**Where**: `src/lib/supabase/authenticated.ts` (novo)
**Depends on**: T1, T2
**Reuses**: env pública (T2); tipagem `Database`
**Requirement**: SEC-01, DD-1, C-1/C-2 (client padrão de escrita)
**Model**: **Fable** (integração de sessão; A-5/doc divergente)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Compila e tipa (`Database`); usa **somente** env pública; `import 'server-only'` presente
- [ ] Cookie adapter segue a API da versão instalada do `@supabase/ssr` (conferida no `node_modules`/types, não em tutorial)
- [ ] Gate **quick** + build
- [ ] **Merge-forward de teste declarado:** a fábrica só é exercitável com sessão real — asserções de efeito ficam em T16 (policies) e T19 (fluxo e2e local); nenhum unit fake aqui

**Tests**: integration (merge-forward → T16/T19) · **Gate**: quick + build
**Verify**: `npm run build`; typecheck.
**Commit**: `feat(auth): client autenticado por cookies via @supabase/ssr (SEC-01)`

---

### T7: `src/proxy.ts` — refresh de sessão + redirect otimista [P]

**What**: Criar o **proxy** do Next 16 (não `middleware.ts` — A-5): matcher `['/admin/:path*']`; cria client `@supabase/ssr` com cookies de request/response; `auth.getUser()` (refresh + regravação de cookies); sem usuário e fora de `/admin/login` → redirect `/admin/login`. **Sem** `export const runtime` (Next 16 lança). Comentário: gate autoritativo é o layout/requireEditor (CVE-2025-29927; design §3.3).
**Where**: `src/proxy.ts` (novo)
**Depends on**: T1, T2
**Reuses**: env pública; padrão de cookie adapter do T6 (flavor request/response)
**Requirement**: SEC-08 (camada otimista), DD-12; F-11
**Model**: **Fable** (armadilha A-5; sessão)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo é `src/proxy.ts` com função/`config.matcher` reconhecidos pelo Next 16 (`next build` lista o proxy)
- [ ] Rotas públicas (`/`, `/resenha/*`) **fora** do matcher (custo zero — conferir que continuam estáticas/dinâmicas como hoje no output do build)
- [ ] `npm run dev`: acessar `/admin` sem sessão → redirect a `/admin/login` (conferência manual mínima; e2e completo na T19)
- [ ] Gate **quick** + build

**Tests**: none (wiring — e2e na T19) · **Gate**: quick + build
**Verify**: output do `next build` mostra proxy; dev manual redireciona.
**Commit**: `feat(auth): proxy Next16 — refresh de sessão + redirect otimista em /admin (SEC-08)`

---

### T8: `requireEditor()` / `requireAdmin()` — gate autoritativo

**What**: Criar `src/lib/auth/requireEditor.ts` (`import 'server-only'`; `cache()` do React): `getUser()` → `unauthenticated`; SELECT `editor` (`id, role, active`) via client autenticado → sem linha ou `active=false` → `forbidden`; senão `ok + {id, role}`. `requireAdmin()` = ok **e** `role='admin'`. Aceitar **client injetável opcional** (padrão `ReadClient` de queries.ts) para teste unitário com stub.
**Where**: `src/lib/auth/requireEditor.ts` (novo) · `src/lib/auth/__tests__/requireEditor.test.ts` (novo)
**Depends on**: T6
**Reuses**: `cache()` + injeção de client (padrão de [review/queries.ts](../../../src/lib/review/queries.ts)); tipos `Database`
**Requirement**: SEC-07, SEC-08, SEC-09, DD-13; F-7/F-8
**Model**: **Fable** (é O gate)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Unit tests com client stub: sem user → `unauthenticated`; user sem linha → `forbidden`; `active=false` → `forbidden`; editor ativo → `ok` c/ role; admin → `requireAdmin` ok; editor em `requireAdmin` → `forbidden`
- [ ] Usa `getUser()` (nunca `getSession()`); não vaza dados no retorno (só o enum + id/role)
- [ ] Gate **quick**

**Tests**: unit · **Gate**: quick
**Verify**: `npx vitest run src/lib/auth/__tests__/requireEditor.test.ts`.
**Commit**: `feat(auth): requireEditor/requireAdmin — sessão+papel no servidor (SEC-07/08/09)`

---

### T9: Página de login `/admin/login` + server action do magic link [P]

**What**: Página `/admin/login` (server-first) com form de e-mail num client component mínimo (`useActionState`); server action `requestMagicLink`: valida e-mail (Zod), chama `signInWithOtp({ email, options: { shouldCreateUser: false } })` via client autenticado, **sempre** retorna a mensagem genérica ("Se este e-mail estiver cadastrado…"). a11y §6 completa: label explícito, `aria-describedby` no erro, live region `role="status"` **presente desde o 1º render**, botão com estado ocupado, erro de callback (`?erro=`) renderizado no servidor com foco no heading. `metadata.robots: noindex`. Spec Playwright axe da rota.
**Where**: `src/app/admin/login/page.tsx` + `actions.ts` + componente do form (novos) · `tests/` spec axe da rota (novo) · unit do form
**Depends on**: T6
**Reuses**: `Field`/`Button` do design system (M0); tokens `lia-*`; padrão de server action do App Router
**Requirement**: SEC-07 (**`shouldCreateUser:false` — A-3, inegociável**), C-1, DD-7/17; F-9 (anti-enumeração); DoD a11y
**Model**: **Fable** (segurança do fluxo + a11y)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `shouldCreateUser: false` presente e **coberto por asserção** (unit da action com client stub: e-mail desconhecido → mesma resposta genérica; nenhuma criação)
- [ ] Unit do form: label associado, live region existe vazia no render inicial, erro usa `aria-describedby`
- [ ] Axe da rota `/admin/login` sem violações críticas (spec novo no Playwright)
- [ ] Mensagem genérica idêntica p/ e-mail conhecido/desconhecido (anti-enumeração)
- [ ] Gate **full** (quick + `npm run test:a11y`)

**Tests**: unit + a11y de rota · **Gate**: full
**Verify**: `npx vitest run src/app/admin/login/**` + `npm run test:a11y` verde.
**Commit**: `feat(auth): login por magic link com conjunto fechado + a11y AA (SEC-07, C-1, A-3)`

---

### T10: Route handlers `/auth/confirm` + `/auth/signout` [P]

**What**: `confirm/route.ts` (GET): lê `token_hash`, `type`, `next`; valida `next` com helper puro `safeNext()` (só caminho relativo `/…`, rejeita `//`, `\`, esquema; default `/admin`); `verifyOtp({ type: 'email', token_hash })`; sucesso → redirect `next`; falha → `/admin/login?erro=link-invalido`. `signout/route.ts` (POST): `signOut()` + redirect `/admin/login`. Unit do `safeNext` (função pura exportada).
**Where**: `src/app/auth/confirm/route.ts` · `src/app/auth/signout/route.ts` (novos) · `src/lib/auth/safeNext.ts` + teste (novos)
**Depends on**: T6
**Reuses**: client autenticado (T6); padrão de route handler do App Router
**Requirement**: C-1 (callback estabelece sessão), SEC-08, DD-7; F-9/F-10
**Model**: **Fable** (verificação de token + open redirect)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `safeNext` unit: `/admin`→ok; `//evil.com`, `https://x`, `\\x`, vazio → default `/admin`
- [ ] token inválido/expirado → redirect com `?erro=` (sem stack, sem detalhe de token)
- [ ] Cookies de sessão gravados **no handler** (nunca em RSC) — conferência manual na T19 com Mailpit local
- [ ] Gate **quick** + build

**Tests**: unit (safeNext) · **Gate**: quick + build
**Verify**: `npx vitest run src/lib/auth/__tests__/safeNext.test.ts`.
**Commit**: `feat(auth): callback token_hash + signout; next validado contra open redirect (C-1, F-10)`

---

### T11: Route group `(protected)` — layout gate + stub + não-autorizado

**What**: `src/app/admin/(protected)/layout.tsx`: `requireEditor()` → `unauthenticated` → `redirect('/admin/login')`; `forbidden` → renderiza tela "não autorizado" (sem dado sensível; botão **Sair** = form POST `/auth/signout`); `ok` → children. `(protected)/page.tsx`: stub mínimo pós-login (nome/papel do editor — prova o helper; **sem painel**, escopo C-5). `/admin/login` fica **fora** do group (design §3.2). `metadata.robots: noindex` no segmento.
**Where**: `src/app/admin/(protected)/layout.tsx` + `page.tsx` + componente da tela não-autorizado (novos)
**Depends on**: T8, T10
**Reuses**: `requireEditor` (T8); componentes base M0
**Requirement**: SEC-07 (barrado: sem editor/inativo), SEC-08 (gate autoritativo), DD-12; F-8
**Model**: **Opus** (wiring de gate; lógica já pronta no T8)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Unit da tela não-autorizado: heading, texto sem dado sensível, form de signout
- [ ] Sem sessão → redirect (conferência dev); a matriz sessão×editor completa é T19
- [ ] `/admin/login` continua acessível sem sessão (fora do group)
- [ ] Gate **quick** + build

**Tests**: unit (tela) · **Gate**: quick + build
**Verify**: dev manual: `/admin` sem sessão → login; typecheck/build verdes.
**Commit**: `feat(auth): gate autoritativo no layout (protected) + tela não-autorizado (SEC-07/08)`

---

### T12: Migration `0007_editor_rbac.sql` — funções + GRANTs + policies de `editor` [P]

**What**: Escrever a migration do design §2.2 **exatamente** (helpers `is_active_editor()`/`is_admin()` `security definer stable set search_path=''` + revoke/grant EXECUTE; `grant select, insert, update on editor to authenticated` — **nada para anon** (A-2); policies `editor_self_read`/`editor_admin_read`/`editor_admin_insert`/`editor_admin_update` com guards `pg_policies`). Aplicar **apenas local** via `db reset`. **NÃO** rodar `db push`.
**Where**: `supabase/migrations/0007_editor_rbac.sql` (novo)
**Depends on**: None (banco local independente do código)
**Reuses**: padrão de idempotência 0003/0005/0006; enum/tabela da 0001
**Requirement**: SEC-06 (schema 0001 confirmado), SEC-10, SEC-12, DD-8/9, C-4; **A-1 (peça crítica — revisão linha a linha)**
**Model**: **Fable** (SQL de segurança; security definer)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npx supabase db reset` local verde (0001→0007), **duas vezes seguidas** (idempotência de reaplicação via reset é implícita; guards conferidos por inspeção)
- [ ] `pg_policies` local mostra as 4 policies de `editor`; `\df public.is_admin` mostra security definer + search_path
- [ ] Funções checam `active` (admin inativo ≠ admin) — asserção completa na T16
- [ ] Nenhum GRANT a `anon` em `editor`

**Tests**: integration (matriz na T16 — merge-forward declarado; aqui: reset + inspeção `pg_policies`) · **Gate**: integration (local)
**Verify**: `npx supabase db reset` + query em `pg_policies`/`pg_proc` local.
**Commit**: `feat(db): 0007 — RBAC de editor: helpers security definer + GRANTs + policies (SEC-10/12)`

---

### T13: Migration `0008_review_editor_write.sql` — escrita own-or-admin

**What**: Migration do design §2.3: `grant insert, update on review to authenticated` (**sem DELETE**); policies `review_editor_read_own`, `review_editor_insert`, `review_editor_update` (own-or-admin via helpers da 0007; `with check` impede transferir posse). Guards `pg_policies`. Aplicar **apenas local**. Comentário no arquivo registrando A-4 (publicação pelo editor da própria — PRD §4/§6.3).
**Where**: `supabase/migrations/0008_review_editor_write.sql` (novo)
**Depends on**: T12 (usa `is_admin`/`is_active_editor`)
**Reuses**: policy `review_public_read` (0005) permanece intacta ao lado
**Requirement**: SEC-10, SEC-11, SEC-13 (não afrouxa leitura), DD-10, C-2, **A-4 (default aprovado)**
**Model**: **Fable**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `db reset` local verde (…→0008)
- [ ] `pg_policies` mostra as 3 novas + `review_public_read` intacta
- [ ] Sem GRANT de DELETE; sem policy para `anon` além da 0005
- [ ] Matriz completa na T16

**Tests**: integration (matriz na T16) · **Gate**: integration (local)
**Verify**: `db reset` + `pg_policies`.
**Commit**: `feat(db): 0008 — escrita de review own-or-admin sob RLS (SEC-10/11, A-4)`

---

### T14: Regressão SEC-14 + SEC-16/19 — env presente ≠ bypass; deny-by-default

**What**: Suíte integration local-only (T-a + T-c do design §5.3): setup injeta `SUPABASE_LOCAL_*` **e** `process.env.SUPABASE_SERVICE_ROLE_KEY=<secret local>` **antes** do import dinâmico da cadeia real (`review/queries` → `public.ts` → `env.ts`, com `NEXT_PUBLIC_*` apontados ao local). Asserções: (a) `getPublishedReviewBySlug('memorias-postumas-rascunho')` → `null`; (b) `listPublishedReviews` → 4 publicadas, draft ausente; (c) anon lê/escreve `comment` e `recommendation` → deny (**vazio OU 42501** — A-2); (d) anon lê `editor` → deny; (e) leituras públicas `book/genre/review published` intactas (SEC-13).
**Where**: `src/lib/supabase/__tests__/public-no-bypass.integration.test.ts` (novo)
**Depends on**: T3, T13
**Reuses**: padrão completo do [rls.integration.test.ts](../../../src/lib/book/__tests__/rls.integration.test.ts) (skipIf, env local, import dinâmico); draft do seed ([seed.sql:66-72](../../../supabase/seed.sql#L66-L72))
**Requirement**: SEC-14 ⭐ (a rede vermelha da TD-04), SEC-16, SEC-19, SEC-13, DD-15
**Model**: **Fable** (é a prova central da feature)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Suíte verde local com a env service **presente** no processo
- [ ] **Prova de vermelhidão**: apontar temporariamente a fábrica pública para a secret key → (a)/(b) falham (draft aparece) → reverter (registrado no PR, não commitado)
- [ ] CI: suíte PULA via `describe.skipIf` (sem env local) e o job vitest segue verde
- [ ] Gate **integration** + quick

**Tests**: integration · **Gate**: integration (local) + quick
**Verify**: `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/supabase/__tests__/public-no-bypass.integration.test.ts`.
**Commit**: `test(security): anon ≠ bypass com service_role no ambiente + deny-by-default (SEC-14/16/19)`

---

### T15: Prova única de fronteira de build (SEC-15b) [P]

**What**: Fixture temporária: client component (`'use client'`) importando `@/lib/supabase/admin`; rodar `npm run lint` (deve reprovar pela regra T5) e, com o lint suprimido na fixture, `npm run build` (deve **falhar** pelo `server-only`). Registrar os dois outputs (trecho) neste tasks.md/PR e **descartar a fixture** (nada commitado além do registro).
**Where**: fixture efêmera em `src/app/` (descartada) · registro no PR/tasks
**Depends on**: T4, T5
**Reuses**: —
**Requirement**: SEC-15(b), SEC-03, DD-3, story P1-clients AC#2
**Model**: **Sonnet**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Lint reprovou a fixture (mensagem da regra registrada)
- [ ] Build reprovou a fixture via `server-only` (erro registrado)
- [ ] Working tree limpa após a prova; build/lint verdes de novo

**Tests**: none (prova manual documentada) · **Gate**: build
**Verify**: outputs registrados; `git status` limpo.
**Commit**: *(sem commit de código — registro vai no corpo do PR e no STATE via T18)*

---

### T16: Matriz RLS por papel (T-f) — `editor` × `review`

**What**: Suíte integration local-only: cria usuários de teste na stack local via **API admin local** (secret local, test-only — padrão do `service` client do rls.integration.test.ts): `admin ativo`, `editor ativo`, `editor inativo`, `authenticated sem linha editor`; monta clients com a sessão de cada um. Matriz: `editor` (self-read ✓; ler outro ✗/admin ✓; insert/update só admin; anon deny) × `review` (insert própria ✓/alheia ✗; update própria ✓/alheia ✗/admin ✓; transferir posse ✗; draft próprio visível, alheio ✗/admin ✓; inativo → tudo ✗; anon escrita ✗). Cleanup idempotente.
**Where**: `src/lib/supabase/__tests__/rbac-matrix.integration.test.ts` (novo)
**Depends on**: T12, T13 (e T14 concluída — mesmo banco, rodar em sequência)
**Reuses**: padrão TD-02 completo; helpers/policies 0007/0008
**Requirement**: SEC-10, SEC-11, SEC-12, story P1-grants AC#1-3; F-5/F-6/F-7
**Model**: **Fable** (cada célula é uma afirmação de segurança)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Todas as células da matriz batem o esperado (permit/deny) — incluindo `editor inativo` = deny total de escrita e `is_admin` exige `active`
- [ ] Nenhuma credencial hardcoded (só `SUPABASE_LOCAL_*`)
- [ ] CI PULA a suíte; local verde
- [ ] Gate **integration** + quick

**Tests**: integration · **Gate**: integration (local)
**Verify**: `$env:RUN_RLS_INTEGRATION='1'; npx vitest run src/lib/supabase/__tests__/rbac-matrix.integration.test.ts`.
**Commit**: `test(security): matriz RLS por papel — editor/review (SEC-10/11/12)`

---

### T17: Runbook — bootstrap do 1º admin + SMTP + gate de rollout [P]

**What**: Documento `docs/runbook-admin-bootstrap.md` com o §3.5 do design: pré-requisito SMTP custom + template Magic Link token_hash (formato exato da URL), passos do dashboard (invite + INSERT de `editor` com placeholders — **sem segredo**), verificação, provisionamento dos seguintes, avisos A-8 (não desativar a si mesmo) e A-9. Seção do **gate SEC-17**: checklist "Production sem `SUPABASE_SERVICE_ROLE_KEY`" + ordem de deploy (A-11: merge → push 0007/0008 → SMTP → bootstrap).
**Where**: `docs/runbook-admin-bootstrap.md` (novo)
**Depends on**: T13 (conteúdo referencia as migrations)
**Reuses**: design §3.5/§5.2
**Requirement**: C-4, SEC-17, A-6/A-8/A-9/A-11, success criteria "bootstrap documentado"
**Model**: **Sonnet**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Runbook completo, sem credencial/URL sensível; placeholders explícitos
- [ ] Gate **quick** (format:check cobre o .md)

**Tests**: none · **Gate**: quick
**Verify**: leitura; `npm run format:check`.
**Commit**: `docs(runbook): bootstrap do 1º admin, SMTP e gate de rollout (C-4, SEC-17)`

---

### T18: D-09 em DECISIONS.md + STATE/ROADMAP — fechamento rastreável

**What**: Registrar **D-09** (modelo de escrita: autenticado+RLS padrão; service_role exceção documentada e dormente) em DECISIONS.md; atualizar STATE.md: TD-04 → *fechada no merge* (com evidência: T14/T15), TD-03 → *reduzida* + **remanescentes SEC-18 listados** (comment/recommendation M3, service_role/Data API, DELETE review, Storage), gate SEC-17 ativo, lições novas (A-3 `shouldCreateUser`, A-5 proxy). ROADMAP: `security-foundation` → status Execute/PR.
**Where**: `.specs/project/DECISIONS.md` · `.specs/project/STATE.md` · `.specs/project/ROADMAP.md`
**Depends on**: T14, T15, T16 (registra resultados reais)
**Reuses**: formato de ADR existente (D-01..D-08)
**Requirement**: SEC-17, SEC-18, D-09 (spec "Notas para o Design"), C-2
**Model**: **Sonnet** (tarefa leve — cabível em modelo mais barato)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] D-09 com decisão/razão/trade-off/impacto; STATE com TD-04/TD-03 atualizadas e remanescentes explícitos; ROADMAP coerente
- [ ] Gate **quick**

**Tests**: none · **Gate**: quick
**Verify**: leitura cruzada spec SEC-18 × STATE.
**Commit**: `docs(state): D-09 + TD-04 fechada / TD-03 reduzida com remanescentes (SEC-17/18)`

---

### T19: Verificação end-to-end local + gate final + checklist de merge

**What**: Com a stack local (`supabase start && db reset`): criar admin de teste **seguindo o runbook T17** (via Mailpit local `127.0.0.1:54324` para capturar o e-mail); percorrer: login → e-mail → confirm → `/admin` (stub com papel); `auth.users` sem editor → não-autorizado; `active=false` → não-autorizado; e-mail desconhecido → mensagem genérica e **nenhum** user criado (A-3). Rodar **full** (quick + axe) + as duas suítes integration + `npm run build`. Preencher checklist de merge: SEC-17 conferido na Vercel (Production sem a var), ordem A-11 registrada no PR.
**Where**: — (verificação; sem código novo, exceto ajustes achados)
**Depends on**: todas (T1–T18)
**Reuses**: runbook T17; Mailpit da stack local
**Requirement**: success criteria do spec (todos); stories P1 AC end-to-end; SEC-17
**Model**: **Fable** (UAT de segurança — julgamento)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Fluxo completo verde local, incluindo os 3 caminhos de negação (sem sessão / sem editor / inativo)
- [ ] `signInWithOtp` de e-mail desconhecido **não** criou `auth.users` (conferir no Studio local — A-3)
- [ ] Gate full + integrations + build verdes; contagem final registrada (baseline 155/16 + novos)
- [ ] Checklist de merge no PR: Vercel Production **sem** `SUPABASE_SERVICE_ROLE_KEY`; STOP do `db push` produção documentado (pós-merge, humano)

**Tests**: e2e manual guiado + suítes existentes · **Gate**: full + integration + build
**Verify**: roteiro acima; screenshots/outputs no PR.
**Commit**: `chore(security): verificação e2e local + gates finais (SEC-14..17)` *(se houver ajustes)*

---

## Validação pré-aprovação (3 gates do skill)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | deps + 1 alias de config | ✅ |
| T2 | camada de env (2 arquivos coesos: split de 1 conceito) | ✅ |
| T3 | 1 fábrica + swap atômico de imports + tripwire (indivisível sem quebrar o build) | ✅ coeso |
| T4–T8 | 1 módulo cada (+ teste co-locado) | ✅ |
| T9 | 1 rota (page+action+form são a mesma entrega) | ✅ coeso |
| T10 | 2 handlers do mesmo fluxo de auth + 1 helper puro | ✅ coeso |
| T11 | 1 route group (layout+stub+tela) | ✅ coeso |
| T12–T13 | 1 migration cada | ✅ |
| T14–T16 | 1 suíte/prova cada | ✅ |
| T17–T19 | 1 doc / 1 registro / 1 verificação | ✅ |

### Check 2 — Diagrama × Depends on

| Task | Body diz | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | início Phase 1 | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T2 | T2→T4 | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T1,T2 | T1,T2→T6 [P] | ✅ |
| T7 | T1,T2 | T1,T2→T7 [P] | ✅ |
| T8 | T6 | T6→T8 | ✅ |
| T9 | T6 | T6→T9 [P] | ✅ |
| T10 | T6 | T6→T10 [P] | ✅ |
| T11 | T8,T10 | T8,T10→T11 | ✅ |
| T12 | None | Phase 2 [P] | ✅ |
| T13 | T12 | T12→T13 | ✅ |
| T14 | T3,T13 | T3,T13→T14 | ✅ |
| T15 | T4,T5 | T4,T5→T15 [P] | ✅ |
| T16 | T12,T13 (+T14 sequência de banco) | T12,T13→T16; T14→T16 anotado | ✅ |
| T17 | T13 | T13→T17 [P] | ✅ |
| T18 | T14,T15,T16 | idem | ✅ |
| T19 | todas | "tudo→T19" | ✅ |

### Check 3 — Co-locação de testes × matriz

| Task | Camada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | config | none | none | ✅ |
| T2 | módulo de env | unit | unit | ✅ |
| T3 | fábrica + swap | unit (tripwire) + comportamento no baseline | unit | ✅ |
| T4 | fábrica admin | unit (contrato de erro) | unit | ✅ |
| T5 | config lint | none (prova negativa) | none | ✅ |
| T6 | fábrica com sessão | integration | merge-forward → T16/T19 (declarado) | ✅ |
| T7 | wiring proxy | none (e2e T19) | none | ✅ |
| T8 | lógica de gate | unit | unit | ✅ |
| T9 | rota + componente | unit + axe | unit + a11y | ✅ |
| T10 | handlers + helper puro | unit (puro) | unit | ✅ |
| T11 | layout/página | unit (tela) + e2e T19 | unit | ✅ |
| T12/T13 | migration | integration | merge-forward → T16 (declarado) + inspeção local | ✅ |
| T14/T16 | suítes integration | integration | integration | ✅ |
| T15/T17/T18/T19 | prova/docs/verificação | none | none | ✅ |

**Cobertura de requisitos: 19/19, sem órfãos** — SEC-01 (T3/T4/T6) · SEC-02 (T2/T3) · SEC-03 (T4/T5/T15) · SEC-04 (T2/T4) · SEC-05 (T3) · SEC-06 (T12) · SEC-07 (T8/T9/T11) · SEC-08 (T7/T8/T10/T11) · SEC-09 (T8) · SEC-10 (T12/T13/T16) · SEC-11 (T13/T16) · SEC-12 (T12/T16) · SEC-13 (T3/T14) · SEC-14 (T14) · SEC-15 (T4/T5/T15) · SEC-16 (T14) · SEC-17 (T17/T18/T19) · SEC-18 (T18) · SEC-19 (T14).
