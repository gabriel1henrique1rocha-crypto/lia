# security-foundation — Especificação

> Milestone **M2 — Painel administrativo**. **A PRIMEIRA feature do M2**: a fundação de segurança que os pré-requisitos exigem — **antes** de qualquer CRUD ou UI de admin.
> Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (seções 4/8 — papéis, RLS), [ROADMAP](../../project/ROADMAP.md) (M2), e as dívidas **TD-03** e **TD-04** registradas em [STATE.md](../../project/STATE.md).
> Fecha **TD-04** (separação de clients) e reduz **TD-03** (GRANTs/policies explícitos por tabela) para as tabelas do M2.
> Documentação em português; identificadores/schema/código em inglês. Gray areas **RESOLVIDAS** em [context.md](context.md) (C-1…C-6, revisão 2026-07-07): magic link (C-1), autenticado+RLS por padrão com `service_role` como exceção mínima (C-2), bootstrap manual do 1º admin (C-4), `admin-auth-editors` fundida aqui (C-5), moderação fora do escopo (C-6).

## Problem Statement

O M2 (painel administrativo) precisa que editores autenticados escrevam no banco — e isso introduz a **`service_role`** e a **autenticação** pela primeira vez. Duas dívidas tornam isso perigoso hoje: **(TD-04)** [server.ts](../../../src/lib/supabase/server.ts) usa o fallback `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — inócuo enquanto a `service_role` não existe em Production, mas que vira **bypass de RLS na rota pública** no instante em que a chave for configurada (e o M2 vai configurá-la). **(TD-03)** Pós-2026-05-30 o Supabase não auto-concede GRANTs, e a RLS é deny-by-default: **cada tabela** que o M2 tocar (`comment`, `editor`, `recommendation` + as escritas de `review`/`book`/`genre`) precisa de **GRANT + policy explícitos** — hoje inexistentes.

Esta feature entrega a **fundação de segurança**: separa os clients Supabase (público anon **sem** fallback × admin `service_role` **isolado**, server-only), estabelece o **modelo de autenticação de editores** (Supabase Auth ↔ `editor`), define os **GRANTs/policies por tabela** do M2, e um **teste de regressão de RLS** que prova que o caminho público nunca acessa a `service_role` — **mesmo que a env var passe a existir**. É pré-requisito duro: **nenhuma `service_role` deve ser configurada em Production até esta feature estar mergeada.**

## Goals

- [ ] **Separar os clients Supabase** em três contextos explícitos e tipados: **público** (anon, leitura pública, **sem** `service_role`, **sem** fallback), **autenticado** (JWT do editor logado — respeita RLS como `authenticated`) e **admin** (`service_role`, **bypassa RLS**, **server-only**, isolado). Remover o fallback `??` de `server.ts`.
- [ ] **Garantir estruturalmente** que o caminho público/cliente **não consiga** importar nem acessar o client `service_role` (fronteira de build/módulo, não só convenção).
- [ ] **Estabelecer a autenticação de editores** via Supabase Auth (editor ↔ `auth.users`, papéis `admin`/`editor`), com verificação de sessão **no servidor** que gateia qualquer caminho que use `service_role`.
- [ ] **Definir GRANTs + policies explícitos** (TD-03) para cada tabela que o M2 toca, com o **modelo de escrita** (autenticado+RLS × `service_role`) decidido por tabela.
- [ ] **Provar não-regressão**: teste de RLS que exercita o caminho **anon** e demonstra que ele lê só o público (drafts/pending invisíveis) e **não** herda `service_role` mesmo com a env var presente.
- [ ] **Fechar TD-04** e **reduzir TD-03**; registrar o **gate de rollout** (sem `service_role` em Production antes do merge).

## Out of Scope

Explicitamente adiado — esta feature é **fundação**, não o painel:

| Item | Motivo / feature futura |
| --- | --- |
| **CRUD de resenhas** (formulário criar/editar, validação, D-01) | `reviews-crud` (M2). Esta feature só habilita o caminho seguro de escrita; não implementa o formulário. |
| **Painel admin (UI)**: dashboard, listas de resenhas, ações publicar/despublicar, formulários | `reviews-crud`/`admin-reviews` (M2). Esta feature entrega a **auth de editor** (fluxo de login magic link + sessão + RBAC no servidor) e a segurança de dados — **não** o painel em si. `admin-auth-editors` do ROADMAP foi **fundida aqui** (C-5). |
| **Moderação de comentários** (fila, aprovar/rejeitar) e **policies de escrita/moderação de `comment`** | `admin-comment-moderation` (M3). Aqui só se **garante/testa** o deny-by-default de `comment` (SEC-19), sem abrir moderação (C-6). |
| **Submissão pública de comentários** (sem login, anti-spam) | `public-comments` (M3, D-02). |
| **Recomendações** (votação/indicação) e policies de `recommendation` | `recommendations` (M3, D-03). Aqui só o deny-by-default (SEC-19). |
| **Políticas de Storage por papel** | Feature própria do M2 (Storage). A separação de clients aqui **habilita**, mas não implementa, as policies de bucket. |
| **Provisionamento em massa de editores / gestão de editores na UI** | Follow-up. Aqui: só o modelo (como um `auth.users` vira `editor`) e o seed do 1º admin. |

---

## Requisitos Funcionais

> IDs `SEC-nn`, rastreáveis. "Client público" = anon/publishable; "client admin" = `service_role`; "client autenticado" = JWT do editor logado.

### Separação de clients (TD-04)

- **SEC-01** — Existem **fábricas de client distintas e nomeadas**: público (anon), autenticado (JWT do editor) e admin (`service_role`). Nenhuma função única decide o papel por env var.
- **SEC-02** — O client **público** usa **exclusivamente** a publishable key. WHEN o client público é construído THEN ele SHALL usar a publishable key e **nunca** referenciar, importar ou cair para a `service_role` (o fallback `?? service_role` é **removido** de `server.ts`).
- **SEC-03** — O módulo do client **admin** (`service_role`) é **server-only**. WHEN código de cliente/público tenta importar o módulo admin THEN o build SHALL **falhar** (fronteira estrutural — ex.: `import 'server-only'`, sem `NEXT_PUBLIC`, guard de lint/boundary), não apenas por convenção.
- **SEC-04** — A `service_role` key é lida de env var **server-only** (sem prefixo `NEXT_PUBLIC`) e validada. WHEN a `service_role` key está **ausente** no ambiente THEN o client admin SHALL falhar de forma explícita (indisponível), **nunca** degradar silenciosamente para anon nem para bypass.
- **SEC-05** — Os caminhos de **leitura pública já existentes** (`review-page`, `review-listing-search`, `book-data`) SHALL migrar para o client público e continuar lendo via **anon** (RLS como gate), **sem mudança de comportamento observável** e sem `service_role` no caminho público.

### Autenticação de editores (Supabase Auth)

> **Modelo de auth de editor (explícito — a decisão estrutural que o Design materializa):**
> **(a) Identidade** — o editor é um usuário do **Supabase Auth** (`auth.users`). O perfil de aplicação é a linha `editor` (schema 0001), **ligada 1:1** ao usuário por **chave primária compartilhada**: `editor.id = auth.users.id` (`editor.id uuid PK references auth.users(id) on delete cascade`). Não há usuário editor sem `auth.users`, nem `editor` órfão.
> **(b) Login** — **magic link** (passwordless) do Supabase Auth (C-1): solicitação por e-mail → link → rota de callback estabelece a **sessão** (cookies server-side; provável `@supabase/ssr`, a confirmar no Design). Sem senha, sem reset de senha.
> **(c) Papéis/permissões** — o papel vive na coluna `editor.role` (enum `editor_role` = `admin` | `editor`, schema 0001) + `editor.active boolean`. A **autorização** é resolvida **no servidor** a partir da sessão: `auth.uid()` → linha `editor` → `role`/`active`. O mesmo par (`auth.uid()`→`editor.role`) alimenta as **policies RLS** de escrita (SEC-11/12), então a regra de papel vale **no app E no banco**.

- **SEC-06** — A identidade do editor é um `auth.users` do Supabase Auth ligado 1:1 à linha `editor` por PK compartilhada (`editor.id = auth.users.id`, schema 0001); o papel é `editor.role ∈ {admin, editor}` e o estado ativo é `editor.active`.
- **SEC-07** — **Login por magic link** (C-1), **sem auto-cadastro público**: o conjunto de editores é fechado; um editor só existe se provisionado (C-4). WHEN alguém sem `auth.users` **e** linha `editor` ativa correspondente tenta autenticar/acessar caminho de editor THEN o sistema SHALL negar.
- **SEC-08** — Todo caminho de servidor que usa o client **admin** ou faz escrita editorial SHALL ser **gateado** por uma **sessão de editor autenticada + verificação de papel** feita **no servidor**, ANTES de qualquer operação. WHEN a requisição não tem sessão de editor válida (ou papel insuficiente) THEN o sistema SHALL negar (sem tocar no banco).
- **SEC-09** — Existe um **helper de servidor** que resolve o editor autenticado atual (uid + papel) a partir da sessão, reutilizável pelos caminhos admin. WHEN não há sessão / o usuário não é `editor` ativo THEN o helper SHALL retornar "não autorizado" (não lança dados sensíveis).

### GRANTs e policies por tabela (TD-03)

- **SEC-10** — GRANTs + policies RLS **explícitos e versionados** (migration aditiva idempotente) para **o que a fundação precisa**: **`editor`** (self-read + admin) e **escrita de `review`** pelo editor autenticado (draft/publish — destrava `reviews-crud`), reafirmando as leituras públicas (0003/0005/0006). Para as demais tabelas do M2 (`comment`, `recommendation`), a fundação **garante e testa o deny-by-default** (RLS habilitada desde 0001; sem GRANT/policy indevidos), **sem** abrir policy de escrita/moderação (ver SEC-19).
- **SEC-11** — **Modelo de escrita RESOLVIDO (C-2 / privilégio mínimo):** o padrão é o **client autenticado (JWT do editor) sob RLS**; a `service_role` é **exceção documentada** (justificativa + gate autenticado por operação) e **fica dormente** nesta feature (nenhuma operação aqui exige bypass — login usa o client autenticado; bootstrap do 1º admin é manual, C-4; provisionar editor é `admin` autenticado + policy). Isso **exige policies de RLS de ESCRITA para o papel autenticado**, keyed no papel via `auth.uid()`→`editor` (SEC-12). WHEN um editor autenticado escreve conforme seu papel THEN a policy SHALL permitir; WHEN anon/sem-papel THEN SHALL negar. A RLS permanece **ativa** no caminho admin (não é bypassada pelo padrão).
- **SEC-12** — Policies de `editor`: um editor autenticado SHALL ler o **próprio** perfil (necessário para resolver papel via `auth.uid()`); `admin` pode ler todos; escrita em `editor` restrita (ver C-2/C-4). WHEN anon lê `editor` THEN SHALL receber vazio (deny-by-default mantido).
- **SEC-13** — As leituras públicas atuais (`book`, `genre`, `review` published — policies 0003/0005/0006) SHALL permanecer **intactas**; esta feature **não afrouxa** o acesso público nem expõe drafts/pending a anon.

### Não-regressão de segurança (validação da TD-04)

- **SEC-14** — Teste de segurança que exercita o **caminho público (anon)** e prova que ele lê **apenas** o público (só `published`; drafts invisíveis) **mesmo quando `SUPABASE_SERVICE_ROLE_KEY` está presente no ambiente** — i.e., o client público **não** herda `service_role`. WHEN a env `service_role` existe E o caminho público é exercido THEN o resultado SHALL ser idêntico ao caminho anon puro (nenhum bypass).
- **SEC-15** — Teste/afirmação de que o client admin (a) **exige** a `service_role` key e um caminho de editor autenticado, e (b) **não pode** ser importado em bundle de cliente (a fronteira do SEC-03 quebra o build se violada).
- **SEC-16** — WHEN uma requisição não autenticada (anon) tenta ler drafts de `review` ou comentários `pending` via o client público THEN SHALL receber vazio (deny-by-default), reproduzindo a garantia validada em prod na M1.

### Rollout e dívidas

- **SEC-17** — **Gate de rollout**: `SUPABASE_SERVICE_ROLE_KEY` **NÃO** SHALL ser configurada em Production até esta feature estar **mergeada** e a separação público/admin no ar. WHEN a `service_role` for introduzida (pós-merge) THEN o caminho público SHALL permanecer anon (SEC-02/SEC-14 garantem).
- **SEC-18** — A conclusão desta feature **fecha TD-04** (fallback removido, clients separados, regressão testada) e **reduz TD-03** (GRANTs/policies dos itens do M2). Itens de TD-03 **remanescentes** (ex.: tabelas não tocadas pelo M2, Storage) SHALL ser listados explicitamente como ainda abertos.
- **SEC-19** — **Limite de escopo explícito (C-6):** a **lógica de moderação** — quem aprova/rejeita `comment`, quem publica/despublica de quem — **NÃO** entra nesta feature; é da `admin-comment-moderation` (M3) / `admin-reviews` (M2). Aqui apenas se **confirma e testa** que `comment` e `recommendation` seguem **deny-by-default**. WHEN anon lê/escreve em `comment` (`pending`) ou `recommendation` THEN SHALL receber vazio/negado. Nenhuma policy de escrita/moderação dessas tabelas é aberta aqui.

---

## User Stories

### P1 — MVP (fundação de segurança)

#### P1: Clients Supabase separados, sem fallback perigoso ⭐
**Como** responsável pela segurança do LIA, **quero** clients público/autenticado/admin separados e o fallback `??` removido, **para** que introduzir a `service_role` no M2 não vire bypass de RLS na rota pública.
**Why P1**: é o pré-requisito que destrava (com segurança) todo o resto do M2.
**Cobre**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05.
**Acceptance**:
1. WHEN a rota pública lê resenhas THEN usa o client público (anon) e o resultado é idêntico ao de hoje.
2. WHEN código de cliente importa o módulo admin THEN o build falha.
3. WHEN a `service_role` está ausente THEN o client admin é indisponível (não degrada para anon).
**Independent Test**: grep/ботa de build prova que `server.ts` não tem mais `?? service_role`; importar o admin num client component quebra o build; a home/`/resenha` seguem verdes.

#### P1: Autenticação de editor no servidor + RBAC ⭐
**Como** editor, **quero** autenticar e ter meu papel verificado no servidor, **para** que só editores autorizados alcancem caminhos que escrevem/usam `service_role`.
**Why P1**: sem auth verificada no servidor, a `service_role` fica exposta a qualquer requisição.
**Cobre**: SEC-06, SEC-07, SEC-08, SEC-09.
**Acceptance**:
1. WHEN um caminho admin recebe requisição sem sessão de editor válida THEN nega antes de tocar o banco.
2. WHEN um `auth.users` sem linha `editor` ativa tenta acessar caminho admin THEN nega.
3. WHEN um editor válido acessa THEN o helper resolve uid + papel corretamente.
**Independent Test**: chamar um caminho admin de teste sem sessão → negado; com sessão de editor → autorizado; com usuário não-editor → negado.

#### P1: GRANTs + policies explícitos das tabelas do M2 ⭐
**Como** operador do banco, **quero** GRANT + policy explícitos por tabela do M2, **para** que a escrita editorial funcione sob RLS sem afrouxar a leitura pública.
**Why P1**: TD-03 — sem isso, escrita autenticada retorna 42501 e/ou a RLS bloqueia tudo.
**Cobre**: SEC-10, SEC-11, SEC-12, SEC-13.
**Acceptance**:
1. WHEN um editor autenticado escreve conforme seu papel THEN a policy permite; anon/sem-papel → negado.
2. WHEN anon lê `editor` THEN vazio.
3. WHEN qualquer papel lê `book/genre/review published` THEN as leituras públicas atuais seguem funcionando.
**Independent Test** (local, TD-02): matriz por tabela — anon vs editor vs admin — cada célula bate o esperado (permit/deny).

#### P1: Prova de não-regressão do bypass (TD-04) ⭐
**Como** revisor de segurança, **quero** um teste que prove que o caminho público não vira bypass mesmo com a `service_role` no ambiente, **para** ter uma rede vermelha se alguém reintroduzir o fallback.
**Why P1**: é a garantia que faltava no M1 — o CI testava só com anon.
**Cobre**: SEC-14, SEC-15, SEC-16.
**Acceptance**:
1. WHEN `SUPABASE_SERVICE_ROLE_KEY` está setada E o caminho público lê THEN vê só `published` (idêntico ao anon).
2. WHEN o teste roda sem a separação (regressão simulada) THEN falha.
**Independent Test**: teste com a env `service_role` presente prova leitura só-público; remover a separação torna o teste vermelho.

### Fase futura (não nesta feature)
- Formulário/validação de CRUD de resenhas — `reviews-crud` (D-01).
- Telas do painel (login, dashboard, ações) — `admin-reviews`.
- Moderação de comentários — `admin-comment-moderation` (M3).
- Policies de Storage por papel — feature de Storage (M2).

---

## Edge Cases

- **`service_role` introduzida em Production** → caminho público continua anon (SEC-02/14); nenhuma rota pública passa a ler por cima da RLS.
- **`service_role` ausente em dev/CI** → client admin indisponível e caminhos admin falham explícito; caminhos públicos seguem normais (SEC-04).
- **Import acidental do client admin em componente client** → build quebra (SEC-03), não vaza a chave no bundle.
- **`auth.users` existe mas sem linha `editor` (ou `active=false`)** → tratado como não-autorizado (SEC-07/09).
- **Editor tenta operar acima do papel** (`editor` fazendo ação de `admin`) → negado pela verificação de papel e/ou policy (SEC-08/11).
- **Sessão expirada/inválida no caminho admin** → negado antes de tocar o banco (SEC-08).
- **Anon tenta ler `editor`/`comment pending`/`review draft`** → vazio (deny-by-default; SEC-12/16).
- **Migration reaplicada** → GRANTs/policies idempotentes (padrão `pg_policies`/GRANT no-op), como 0003–0006.

---

## Requirement Traceability

| Requirement ID | Story | Fecha/Reduz | Phase | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | Clients separados | TD-04 | Specify | Pending |
| SEC-02 | Público sem fallback | TD-04 | Specify | Pending |
| SEC-03 | Admin server-only (build boundary) | TD-04 | Specify | Pending |
| SEC-04 | service_role env server-only, sem degradação | TD-04 | Specify | Pending |
| SEC-05 | Leituras públicas migram sem mudança | TD-04 | Specify | Pending |
| SEC-06 | Editor ↔ auth.users (PK compartilhada), papel/active | — | Specify | Pending |
| SEC-07 | Login magic link; sem auto-cadastro (conjunto fechado) | — | Specify | Pending |
| SEC-08 | Gate de sessão+papel no servidor | — | Specify | Pending |
| SEC-09 | Helper de editor autenticado | — | Specify | Pending |
| SEC-10 | GRANT+policy explícitos por tabela | TD-03 | Specify | Pending |
| SEC-11 | Escrita padrão autenticado+RLS; service_role exceção | TD-03 | Specify | Pending |
| SEC-12 | Policies de `editor` | TD-03 | Specify | Pending |
| SEC-13 | Leituras públicas intactas | — | Specify | Pending |
| SEC-14 | Regressão: público ≠ bypass com env presente | TD-04 | Specify | Pending |
| SEC-15 | Admin exige service_role + boundary | TD-04 | Specify | Pending |
| SEC-16 | Deny-by-default anon (draft/pending) | — | Specify | Pending |
| SEC-17 | Gate de rollout (sem service_role até merge) | TD-04 | Specify | Pending |
| SEC-18 | Fecha TD-04, reduz TD-03; lista remanescentes | TD-03/04 | Specify | Pending |
| SEC-19 | Moderação fora; comment/recommendation deny-by-default | — | Specify | Pending |

**Coverage:** 19 requisitos · **0/19 implementados** (fase Specify).

---

## Success Criteria

- [ ] `server.ts` sem o fallback `?? service_role`; clients público/autenticado/admin separados e tipados.
- [ ] Módulo admin server-only — importá-lo de código client quebra o build.
- [ ] Autenticação de editor via Supabase Auth com verificação de sessão+papel no servidor gateando os caminhos admin.
- [ ] GRANTs + policies explícitos (migration aditiva idempotente) para as tabelas do M2, com o modelo de escrita por tabela documentado; leituras públicas atuais intactas.
- [ ] Teste de RLS prova: anon lê só público **com `service_role` presente no ambiente**; drafts/pending invisíveis; regressão da separação fica vermelha.
- [ ] TD-04 marcada **fechada**; TD-03 **reduzida** com remanescentes listados; nota de rollout (sem `service_role` em Production até o merge) registrada em STATE/DECISIONS.
- [ ] Login por **magic link** funcionando (solicitação + callback + sessão); bootstrap manual do 1º admin **documentado** (runbook), sem credencial no repo.
- [ ] `admin-auth-editors` **fundida** nesta feature no ROADMAP (sem entrada duplicada).
- [ ] a11y: a única superfície de UI é o **fluxo de login** (magic link) — ela respeita a DoD de a11y do projeto (teclado, foco, contraste, axe); a fundação em si (clients/RLS) não tem telas.

---

## Notas para o Design (gray areas já RESOLVIDAS em context.md; aqui só o que o Design materializa)

> As decisões C-1..C-6 estão **fechadas** ([context.md](context.md)). Restam questões de **materialização** (o "como"), não de escopo:

- **Mecanismo de sessão no App Router**: magic link + sessão por cookies server-side → provável `@supabase/ssr` além do `@supabase/supabase-js` atual. **Verificar no Design** (Context7/docs), sem fabricar API.
- **Fluxo magic link concreto**: página de solicitação (e-mail) + rota de callback + verificação do provedor de e-mail do projeto Supabase (a11y na página de login).
- **Fronteira estrutural do admin** (C-3 resolvida): materializar `import 'server-only'` + env sem `NEXT_PUBLIC` + a regra de lint de import boundary.
- **Onde os caminhos admin vivem** (route handlers `/api/admin/*` × server actions no segmento `/admin`) e como o guard aplica o gate de sessão+papel (SEC-08/09).
- **Matriz de policies RLS de escrita por papel** (admin × editor × authenticated × anon) para `editor` e `review` — a partir de C-2/SEC-11/12; escrever o SQL das policies + GRANTs.
- **Teste de regressão (SEC-14/15)**: como injetar `SUPABASE_SERVICE_ROLE_KEY` no ambiente do teste e provar que o client público não a herda; e a asserção de build-boundary (SEC-15).
- **Runbook do bootstrap do 1º admin** (C-4): passos exatos no dashboard/SQL, sem segredo no repo.
- **D-09** (se confirmada): registrar a ADR do modelo de escrita (autenticado+RLS por padrão; `service_role` exceção) em DECISIONS.md.
