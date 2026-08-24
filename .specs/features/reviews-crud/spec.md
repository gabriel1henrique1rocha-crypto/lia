# reviews-crud — Especificação

> Milestone **M2 — Painel administrativo**. Segunda feature do M2, **sobre a fundação** de [`security-foundation`](../security-foundation/spec.md) (mergeada): auth de editor (magic link + `requireEditor`/`requireAdmin`), 3 clients isolados e a **RLS own-or-admin de `review` provada** na matriz A×B (0008 — INSERT/UPDATE own incl. publish, DELETE admin-only).
> Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (seções 4/6 — painel editorial, ciclo rascunho→publicação), [ROADMAP](../../project/ROADMAP.md) (M2), [DECISIONS.md](../../project/DECISIONS.md) (D-01, D-09, D-10) e as dívidas **TD-03** (GRANTs por tabela/coluna) em [STATE.md](../../project/STATE.md).
> Documentação em português; identificadores/schema/código em inglês.
> **Escopo:** esta feature é a **UI de escrita** do painel sobre as tabelas `book`/`review`/`genre` que **JÁ existem** — **não cria tabelas novas**; escreve via as policies own-or-admin já provadas. Campos que não couberem no schema atual entram por **migration aditiva** (`0009`, TD-03), não por tabela nova.
> Gray areas em [context.md](context.md) — **algumas PENDENTES** de decisão humana (sobretudo a **CAPA**) antes do Design.

> ---
> **EMENDA 2026-08-24 — [D-11](../../project/DECISIONS.md) REMOVEU A NOTA DO PRODUTO.** O OLDA é observatório de literatura e deficiência: a avaliação numérica não serve ao propósito editorial. **REV-07 (nota inteira 0–5) está REMOVIDO**; a captura, a exibição, o filtro e a ordenação por nota saem do escopo. O texto original é preservado abaixo, riscado e marcado — apagá-lo quebraria o mapa de rastreabilidade e as referências cruzadas a REV-07. **REV-07-schema NÃO é afetado** (é sobre GRANTs/policies de `book`, não sobre nota). A coluna `review.rating` **não é dropada** — ver ORDEM DE REMOÇÃO em D-11.

## Problem Statement

A `security-foundation` provou o **caminho seguro de escrita** (editor autenticado, RLS own-or-admin em `review`) mas **não entregou tela nenhuma para escrever**. Hoje uma resenha só entra no banco por seed/SQL. Editores precisam de um **formulário estruturado** em `/admin`, atrás do gate `requireEditor`, para **criar, editar, publicar e despublicar** resenhas no fluxo **rascunho → publicado** — com **todos os campos preenchidos antes de publicar** — mapeando uma submissão única para as **duas tabelas** (`book` + `review`). O modelo de campos segue uma resenha real em padrão ABNT (ficha bibliográfica + classificação + conteúdo estruturado), e vários desses campos **ainda não existem** no schema.

## Goals

- [ ] **Formulário estruturado** em `/admin` (atrás de `requireEditor`) para **criar/editar/publicar/despublicar** resenhas, cobrindo o modelo de campos ABNT completo.
- [ ] **Escrita exclusivamente via client autenticado** (`createAuthenticatedClient`) **sob RLS** own-or-admin (precedente D-09/D-10) — **nunca** browser client com JWT, **nunca** `service_role` para escrita normal. Server actions.
- [ ] **Mapear uma submissão única** para `book` **e** `review` de forma **atômica** (sem livro órfão nem resenha sem livro).
- [ ] **Ciclo rascunho → publicado** com **gate de publicação**: só publica com o conjunto obrigatório de campos preenchido e válido; despublicar volta a rascunho (some do público via RLS).
- [ ] ~~**Fechar D-01** (nota inteira 0–5) e~~ **REMOVIDO POR D-11** (a nota saiu do produto; D-01 superseded) — segue valendo: **acomodar os campos novos** por migration aditiva idempotente + GRANTs explícitos (TD-03), **provisionando também a escrita de `book`** (a 0008 cobriu só `review`).
- [ ] **Acessibilidade WCAG 2.1 AA** como Definition of Done do formulário (labels associados, erros via `aria-live`, foco visível, sem dependência de cor, validação acessível).

## Out of Scope

Explicitamente adiado — esta feature é o **formulário de resenha**, não o painel inteiro nem a interação pública:

| Item | Motivo / feature futura |
| --- | --- |
| **Dashboard admin completo** (tabela geral de resenhas, filtros avançados, ações em massa, **UI de DELETE**) | `admin-reviews` (M2). A **policy** de DELETE admin-only **já existe** (0008); a **tela** de exclusão fica lá. Esta feature entrega o formulário e o mínimo para **chegar ao editar** (ver REV-24, gray area). |
| **Moderação de comentários** (fila, aprovar/rejeitar) | `admin-comment-moderation` (M3). |
| **Comentários públicos** (sem login, anti-spam) | `public-comments` (M3, D-02). |
| **Recomendações/votação** | `recommendations` (M3, D-03). |
| **Métricas/relatórios** (mais vistas, buscas populares) | `analytics-reports` (pós-MVP). |
| **Upload real de capa para o Supabase Storage** | `storage-covers` (M2) — **decisão CAPA=a**: só `cover_url` textual agora. |
| **Gestão de editores na UI** (criar/desativar editor) | Follow-up; o bootstrap é manual (C-4 da fundação). |
| **Filtragem por tags na listagem pública** | Extensão de `review-listing-search` — **decisão TAGS=c**: guardar/exibir agora, filtrar depois. |

---

## Modelo de campos → mapeamento nas tabelas

Uma resenha é **uma entidade lógica** que grava em **duas tabelas** (`book` 1—1 `review` via `review.book_id` unique). Legenda: ✅ existe · 🆕 coluna nova (migration 0009) · ❓ decisão pendente.

| Campo (formulário) | Destino | Schema | Nota |
| --- | --- | --- | --- |
| **Ficha bibliográfica** | | | |
| autor (`Sobrenome, Nome`) | `book.author` | ✅ | convenção "Sobrenome, Nome" validada no app |
| título do livro | `book.title` | ✅ | |
| cidade de publicação | `book.publication_city` | 🆕 | **não existe** hoje |
| editora | `book.publisher` | ✅ | |
| ano | `book.year` | ✅ | `smallint`, CHECK 1..2100 (0002) |
| ISBN | `book.isbn` | ✅ | opcional; validado via `isbn.ts` se presente (REV-13) |
| resenhista (autor da resenha) | `editor.name` (via `review.editor_id`) | ✅ | **derivado da conta** (decisão): sem coluna nova. Exibir no público exige expor `editor.name` ao anon — ver Design |
| **Classificação** | | | |
| gênero | `book.genre_id` | ✅ | FK `genre`, NOT NULL (0002) |
| ~~nota (0–5, inteiros)~~ | ~~`review.rating`~~ | ❌ | **REMOVIDO POR D-11** — não capturada, não exibida, não filtrada. Coluna fica **dormente** (não dropada aqui; ver ORDEM DE REMOÇÃO em D-11) |
| tags (filtráveis por conceito) | `review.tags` | 🆕 | **guardadas/exibidas** aqui; filtragem na listagem **adiada** (TAGS=c) |
| palavras-chave (não-filtráveis) | `review.keywords` | 🆕 | campo distinto de tags (SEO/exibição) |
| **Conteúdo** | | | |
| título da resenha (headline) | `review.title` | ✅ | alvo do slug e da busca da home; default = título do livro (Design) |
| corpo | `review.body` | ✅ | "sobre o autor/autora" **faz parte do corpo** (travado) |
| frase de destaque | `review.highlight_quote` | 🆕 | citação com realce visual |
| para saber mais (links) | `review.further_reading` | 🆕 | lista de links externos (label + URL) |
| **Capa** | | | |
| capa | `book.cover_url` (texto) | ✅ | **referência textual** (CAPA=a); upload ao Storage adiado (`storage-covers`) |
| **Estado** | | | |
| estado | `review.status` | ✅ | `draft` / `published` |
| (proprietário) | `review.editor_id` | ✅ | setado = `auth.uid()` no create (RLS own) |

**Colunas novas na 0009 (🆕):** `book.publication_city`, `review.keywords`, `review.tags`, `review.highlight_quote`, `review.further_reading`. **Sem** `reviewer_name` (resenhista = `editor.name`, decisão). **GRANTs de escrita de `book`** (INSERT/UPDATE por `authenticated` + policies) — **ausentes hoje** (0008 cobriu só `review`).

---

## Requisitos Funcionais

> IDs `REV-nn`, rastreáveis. "Client autenticado" = JWT do editor via cookies, papel `authenticated` sob RLS (`createAuthenticatedClient`). "Gate" = `requireEditor()`/`requireAdmin()`.

### Acesso e caminho de escrita

- **REV-01** — O formulário vive em `/admin` dentro do **route group `(protected)`**, atrás de `requireEditor()`. WHEN um visitante anon ou um `auth.users` sem linha `editor` ativa acessa a rota do formulário THEN o sistema SHALL negar (redirect ao login / 403), **antes** de qualquer renderização de dados sensíveis.
- **REV-02** — Toda escrita (INSERT/UPDATE de `book` e `review`; publish/unpublish) SHALL passar pelo **client autenticado** (`createAuthenticatedClient`) **sob RLS**, via **server action** gateada por `requireEditor()`/`requireAdmin()` ANTES de tocar o banco. WHEN qualquer caminho tenta escrever com browser client + JWT, ou com `service_role` para escrita normal THEN é **proibido** (D-09/D-10). O gate por operação **não** é substituído pelo layout.
- **REV-03** — A submissão do formulário representa **uma entidade lógica** (resenha) que grava em **`book` E `review`**. WHEN o editor salva THEN o sistema SHALL persistir os campos bibliográficos em `book` e os de conteúdo/estado em `review`, ligados por `review.book_id`.
- **REV-04** — A submissão é **atômica**: WHEN a escrita de `book` **ou** de `review` falha (validação, RLS/42501, rede) THEN o sistema SHALL **não** deixar estado parcial (nem `book` órfão sem `review`, nem `review` sem `book`) e SHALL reportar erro acessível ao editor. *(Mecanismo — RPC transacional × ordem compensável — é decisão de Design.)*
- **REV-05** — No **create**, `review.editor_id` SHALL ser setado como `auth.uid()` do editor logado (estabelece a posse → RLS own da 0008). WHEN um editor cria uma resenha THEN ele passa a ser o dono; WHEN tenta gravar `editor_id` de outro THEN a policy nega (WITH CHECK da 0008).

### Schema e migration (TD-03)

- **REV-06** — Os campos que **não existem** no schema atual (`book.publication_city`, `review.keywords`, `review.tags`, `review.highlight_quote`, `review.further_reading`) SHALL ser adicionados por **migration aditiva idempotente `0009`** (padrão DO-guard das 0001–0008), **sem** tabela nova. WHEN a 0009 é reaplicada THEN é no-op (colunas/policies idempotentes). *(Sem `reviewer_name`: o resenhista deriva de `editor.name` — decisão.)*
- **REV-07-schema** *(consequência da TD-03)* — A 0009 SHALL conceder os **GRANTs de escrita de `book`** a `authenticated` (INSERT/UPDATE) + **policies RLS** de escrita de `book` — **inexistentes hoje** (a 0008 cobriu só `review`) — de forma consistente com o modelo own-or-admin. WHEN um editor cria/edita a ficha do livro da própria resenha THEN a policy permite; WHEN anon escreve em `book` THEN nega. *(O modelo de posse de `book` — catálogo compartilhado × posse transitiva via `review` — é ponto de Design; ver gray area BOOK-WRITE.)*

### Nota (D-01)

- **REV-07** — ~~**REMOVIDO POR D-11 (2026-08-24)**~~ · *Texto original preservado para rastreabilidade; **não implementar**.* ~~A nota SHALL ser **inteira de 0 a 5** (D-01 = Aceita nesta feature): **sem meio-ponto**, o que também elimina o bug histórico do `",5/5"`. WHEN o editor informa a nota THEN a entrada aceita **apenas** inteiros 0–5 (controle acessível — ex.: grupo de opções/estrelas com rótulo textual); WHEN um valor fora de {0,1,2,3,4,5} chega THEN é rejeitado com erro acessível. *(Enforcement no banco — CHECK `rating = trunc(rating)` × validação só no app — é decisão de Design; a coluna `numeric(2,1)` é mantida.)*~~

### Tags e palavras-chave (campos distintos)

- **REV-08** — **Tags** são um campo **filtrável por conceito** (decisão travada), mas **nesta feature são guardadas e exibidas apenas** — a **filtragem por tag na listagem pública é adiada por completo** (TAGS=c; extensão futura de `review-listing-search`). WHEN o editor adiciona tags THEN são persistidas normalizadas e exibidas na resenha; nenhum filtro/param de tag é ligado na home aqui.
- **REV-09** — **Palavras-chave** são um campo **distinto** de tags, **não-filtrável** (exibição/SEO apenas). WHEN o editor informa palavras-chave THEN são persistidas sem virar filtro da busca. Tags e palavras-chave **nunca** se confundem no formulário nem no schema.

### Conteúdo estruturado

- **REV-10** — O **corpo** é texto longo; a seção **"sobre o autor/autora" faz parte do corpo**, **sem campo próprio** (travado). O editor de corpo SHALL aceitar o texto integral da resenha.
- **REV-11** — A **frase de destaque** (`highlight_quote`) é uma **citação única** com **realce visual** na página pública. WHEN preenchida THEN é exibida com destaque; WHEN vazia THEN a página omite o bloco (sem placeholder).
- **REV-12** — **Para saber mais** (`further_reading`) é uma **lista ordenada de links externos** (cada item = rótulo + URL). WHEN o editor adiciona um link THEN a **URL é validada** (esquema `http`/`https`); WHEN inválida THEN erro acessível no item; a lista pode ter 0..N itens.

### Ficha bibliográfica

- **REV-13** — O **ISBN** é **opcional**; WHEN presente THEN é validado por **checksum** reusando `src/lib/book/isbn.ts` (ISBN-10/13, precedente `book-data`), **armazenado normalizado** e **exibido formatado**; WHEN ausente THEN a resenha é válida sem ISBN. ISBN inválido bloqueia o salvamento com erro acessível.
- **REV-14** — O formulário SHALL capturar os campos da ficha: autor (`Sobrenome, Nome`), título do livro, **cidade de publicação** (nova), editora, ano, ISBN, **gênero** (select de `genre` existente). O **resenhista** é **derivado de `editor.name`** (via `review.editor_id`), **não** é campo digitável (decisão). WHEN o gênero não é escolhido THEN o salvamento é bloqueado (`book.genre_id` é NOT NULL — 0002). *(Exibir o resenhista no público exige expor `editor.name` ao anon — ver Notas para o Design.)*

### Ciclo rascunho → publicado

- **REV-15** — Uma resenha nova nasce como **`draft`**. WHEN o editor salva um rascunho THEN campos podem estar incompletos (só o mínimo estrutural para persistir — ex.: título, livro, gênero).
- **REV-16** — **Gate de publicação:** WHEN o editor tenta **publicar** THEN o sistema SHALL exigir que **todos os campos obrigatórios** estejam preenchidos e válidos; WHEN faltar algum THEN a publicação é **bloqueada** com erros **acessíveis** (via `aria-live`), sem publicar. *(O conjunto exato de "obrigatórios para publicar" é definido no Design a partir do modelo de campos; proposta em context.md.)*
- **REV-17** — Publicar SHALL setar `review.status = 'published'` e **carimbar `published_at`** na primeira publicação. WHEN publicada THEN a resenha aparece na home/`/resenha/[slug]` (leitura pública já em produção).
- **REV-18** — Despublicar SHALL voltar `review.status = 'draft'`. WHEN despublicada THEN some do público (RLS `review_public_read` filtra `published`) **sem apagar** o registro. *(Retenção/limpeza de `published_at` no unpublish = detalhe de Design.)*
- **REV-19** — **Editar** uma resenha existente respeita a RLS own-or-admin (0008): um `editor` edita as **próprias**; `admin` edita **todas**. WHEN um editor edita resenha de outro (não-admin) THEN a policy nega. Editar uma resenha **publicada** mantém-na publicada (a edição vale ao vivo), salvo despublicação explícita.

### Capa

- **REV-20** — A **capa** é uma **referência textual** em `book.cover_url` (CAPA=a): o formulário aceita a **URL da capa** (campo de texto). O **upload real ao Supabase Storage é adiado** para `storage-covers` (M2). WHEN a resenha não tem capa THEN a página pública degrada com o placeholder tipográfico existente (backlog do "bloco vinho" à parte).

### Acessibilidade e feedback

- **REV-21** — O formulário SHALL cumprir **WCAG 2.1 AA** (DoD): cada campo com **label associado**; **erros anunciados via `aria-live`**; **foco visível**; **sem dependência de cor** (erro/estado também por texto/ícone); validação **operável por teclado** e por leitor de tela; grupos (~~nota~~ — removida por D-11 —, tags, links) com semântica de `fieldset`/`legend` quando aplicável.
- **REV-22** — WHEN a escrita falha por **RLS (42501)**, sessão perdida, ou erro do banco THEN o sistema SHALL mostrar mensagem **acessível e amigável** (não um 500 cru / stack), preservando o que o editor digitou; WHEN a escrita conclui THEN há **confirmação acessível** (sucesso anunciado).
- **REV-23** — `review.slug` SHALL ser **gerado do título da resenha**, **único**; WHEN há colisão de slug THEN o sistema resolve deterministicamente (ex.: sufixo), sem violar o UNIQUE do schema nem quebrar URLs públicas existentes.
- **REV-24** — Existe uma **lista mínima** em `/admin/resenhas` (PAINEL=a): as resenhas do editor (own-or-admin), rascunhos + publicadas, **só para navegar até o editar/despublicar** — **sem** filtros, ações em massa ou UI de delete (isso é `admin-reviews`). WHEN um editor abre o painel THEN vê e alcança as próprias resenhas; WHEN é admin THEN vê todas.

---

## User Stories

### P1 — MVP (cadastro funcional do rascunho à publicação)

#### P1: Criar e publicar uma resenha completa ⭐
**Como** editor, **quero** um formulário estruturado em `/admin` que capture a ficha bibliográfica, a classificação e o conteúdo, e me deixe publicar quando tudo estiver preenchido, **para** publicar uma resenha do rascunho à publicação sem tocar no banco.
**Why P1**: é o objetivo da feature e o gargalo do MVP (alunos testando na 2ª semana de agosto).
**Cobre**: REV-01..07, REV-10..17, REV-21, REV-23.
**Acceptance**:
1. WHEN um editor logado preenche todos os campos e publica THEN a resenha vira `published`, carimba `published_at` e aparece na home/`/resenha/[slug]`.
2. WHEN tenta publicar com campo obrigatório faltando THEN a publicação é bloqueada com erro acessível e nada é publicado.
3. WHEN um anon/não-editor acessa a rota THEN é negado antes de qualquer dado.
**Independent Test**: logar como editor, cadastrar uma resenha real (ex.: "Hibbert, Talia"), publicar, ver na home; tentar publicar incompleta e ver o bloqueio acessível.

#### P1: Editar e despublicar a própria resenha ⭐
**Como** editor, **quero** editar e despublicar minhas resenhas, **para** corrigir conteúdo e retirar do ar sem apagar.
**Why P1**: sem editar/despublicar, o ciclo editorial fica quebrado.
**Cobre**: REV-18, REV-19, REV-24, REV-02 (RLS own-or-admin), REV-22.
**Acceptance**:
1. WHEN um editor edita a própria resenha THEN as mudanças persistem; WHEN edita a de outro (não-admin) THEN a RLS nega.
2. WHEN despublica THEN a resenha some do público mas permanece editável como rascunho.
**Independent Test**: editar uma resenha própria e ver o efeito público; tentar editar a de outro editor e ver a negação (matriz local TD-02).

### P2 — Conteúdo rico

#### P2: Tags, palavras-chave, frase de destaque e "para saber mais"
**Como** editor, **quero** classificar com tags (filtráveis) e palavras-chave (não-filtráveis), destacar uma citação e apontar leituras, **para** enriquecer a resenha e a descoberta.
**Cobre**: REV-08, REV-09, REV-11, REV-12.
**Acceptance**:
1. WHEN adiciono tags THEN ficam persistidas de forma pesquisável (distintas das palavras-chave).
2. WHEN adiciono links "para saber mais" com URL inválida THEN erro acessível no item.
**Independent Test**: cadastrar tags+palavras-chave distintas e uma citação; conferir persistência e exibição.

### P3 — Capa (depende da decisão de CAPA)

#### P3: Capa da resenha
**Como** editor, **quero** associar uma capa, **para** a resenha exibir a imagem do livro.
**Cobre**: REV-20.
**Acceptance**: conforme a opção escolhida (texto/Storage/nenhuma).

---

## Edge Cases

- **Publicar com campo obrigatório faltando** → publicação bloqueada, erros via `aria-live`, nada persistido como `published` (REV-16).
- **Salvar rascunho incompleto** → permitido (só o mínimo estrutural), sem carimbar `published_at` (REV-15).
- **ISBN com checksum inválido** → salvamento bloqueado com erro acessível; ISBN vazio → resenha válida (REV-13).
- ~~**Nota não-inteira / fora de 0–5** (ex.: legado `4,5`) → rejeitada; entrada só aceita inteiros (REV-07).~~ **REMOVIDO POR D-11** — não há entrada de nota.
- **Editor edita/despublica resenha de outro editor** (não-admin) → negado pela RLS own-or-admin 0008 (REV-19).
- **Sessão expira no meio do preenchimento** → server action nega no gate; mensagem acessível; texto preservado quando possível (REV-22).
- **Escrita de `book` sem GRANT/policy** (estado atual) → 42501 até a 0009 provisionar (REV-07-schema).
- **Falha após gravar `book` e antes de `review`** → sem `book` órfão (REV-04).
- **Colisão de slug** (dois títulos iguais) → sufixo determinístico, UNIQUE preservado (REV-23).
- **Migration 0009 reaplicada** → idempotente (colunas/GRANTs/policies no-op), como 0002–0008.
- **URL de "para saber mais" com esquema não-http(s)** (ex.: `javascript:`) → rejeitada (REV-12).

---

## Requirement Traceability

| Requirement ID | Story | Depende de / Fecha | Phase | Status |
| --- | --- | --- | --- | --- |
| REV-01 | Criar/publicar | gate `security-foundation` | Specify | Pending |
| REV-02 | Criar/publicar; Editar | D-09/D-10, 0008 | Specify | Pending |
| REV-03 | Criar/publicar | book+review | Specify | Pending |
| REV-04 | Criar/publicar | atomicidade (Design) | Specify | Pending |
| REV-05 | Criar/publicar | RLS own (0008) | Specify | Pending |
| REV-06 | Criar/publicar | TD-03, migration 0009 | Specify | Pending |
| REV-07-schema | Criar/publicar | TD-03, GRANT `book` | Specify | Pending |
| ~~REV-07~~ | ~~Criar/publicar~~ | ~~D-01~~ → **D-11** | Specify | **Removido (D-11)** |
| REV-08 | Conteúdo rico | review-listing-search | Specify | Pending |
| REV-09 | Conteúdo rico | — | Specify | Pending |
| REV-10 | Criar/publicar | corpo | Specify | Pending |
| REV-11 | Conteúdo rico | 0009 | Specify | Pending |
| REV-12 | Conteúdo rico | 0009 | Specify | Pending |
| REV-13 | Criar/publicar | reuso `isbn.ts` | Specify | Pending |
| REV-14 | Criar/publicar | 0009 (`publication_city`) | Specify | Pending |
| REV-15 | Criar/publicar | status draft | Specify | Pending |
| REV-16 | Criar/publicar | gate de publicação | Specify | Pending |
| REV-17 | Criar/publicar | published_at | Specify | Pending |
| REV-18 | Editar/despublicar | RLS 0005 | Specify | Pending |
| REV-19 | Editar/despublicar | RLS own-or-admin 0008 | Specify | Pending |
| REV-20 | Capa | **gray area CAPA** | Specify | Pending |
| REV-21 | Todas | WCAG 2.1 AA (DoD) | Specify | Pending |
| REV-22 | Editar/publicar | feedback acessível | Specify | Pending |
| REV-23 | Criar/publicar | slug único | Specify | Pending |
| REV-24 | Editar/despublicar | **gray area PAINEL** | Specify | Pending |

**Coverage:** 25 requisitos · **0/25 implementados** (fase Specify).

---

## Success Criteria

- [ ] Editor logado cria uma resenha real (modelo ABNT completo) e a publica **sem tocar no banco**; ela aparece na home/`/resenha/[slug]`.
- [ ] Publicação **bloqueada** quando faltam campos obrigatórios, com erros **acessíveis** (`aria-live`); rascunho incompleto é salvável.
- [ ] Toda escrita passa pelo **client autenticado sob RLS** (own-or-admin), via server action gateada; **zero** `service_role`/browser-JWT para escrita normal.
- [ ] Submissão única grava `book` **e** `review` de forma **atômica** (sem órfãos).
- [ ] Migration **0009** aditiva/idempotente adiciona os campos novos + **GRANTs/policies de escrita de `book`** (TD-03); leituras públicas 0003–0006 **intactas**.
- [ ] Nota **inteira 0–5** (D-01) validada de forma acessível; sem meio-ponto.
- [ ] ISBN opcional validado por `isbn.ts` (checksum) quando presente; normalizado/formatado.
- [ ] `axe`/Lighthouse sem erros críticos na(s) tela(s) do formulário; navegação por teclado + leitor de tela OK.
- [ ] D-01 registrada **Aceita** em DECISIONS.md; TD-03 reduzida com remanescentes listados; gray area CAPA resolvida e refletida no escopo.

---

## Notas para o Design (o "como", após as gray areas resolvidas)

> Materialização, não escopo. As gray areas PENDENTES (CAPA, TAGS, RESENHISTA, PAINEL, BOOK-WRITE, enforcement de nota) são resolvidas em [context.md](context.md) **antes** do Design.

- **Atomicidade book+review** (REV-04): RPC/`function` transacional no Postgres × ordem compensável na server action. Escolher e justificar.
- **Provisionamento de escrita de `book`** (REV-07-schema): definir o modelo de posse de `book` sob RLS — o `book` é catálogo compartilhado (qualquer editor ativo cria) ou posse transitiva via `review`? INSERT de `book` novo não tem `review` ainda (ordem de gravação). Escrever SQL da 0009 (GRANT + policies) espelhando o padrão anti-recursão da 0007/0008.
- **Resenhista público** (REV-14, decisão "derivar de `editor.name`"): a página pública é **anon** e a RLS de `editor` (0007) só tem self-read + admin — **anon não lê `editor`**. Para exibir o resenhista, o Design escolhe entre **(i)** policy pública que expõe **só `editor.name`** (subset seguro, sem e-mail) para editores donos de resenha **publicada**, ou **(ii)** **denormalizar** o nome no `review` na publicação. Entra na 0009. É staff-byline intencional (não fere a privacidade de visitantes do PROJECT), mas **não é automático**.
- **Forma de armazenamento de `tags`/`keywords`/`further_reading`** (REV-08/09/12): `text[]` × tabela `tag` + join × `jsonb`. Decidir por prazo e por como a listagem consumiria a filtragem por tag.
- ~~**Enforcement de nota inteira** (REV-07): CHECK no banco (`rating = trunc(rating)`) × só validação no app; conferir se há dado legado não-inteiro em produção antes de um CHECK.~~ **SEM OBJETO — REMOVIDO POR D-11** (não há nota a constranger; o CHECK saiu da 0009).
- **Conjunto "obrigatório para publicar"** (REV-16): derivar do modelo de campos; proposta inicial em context.md.
- **Server actions × route handlers** e onde vivem os caminhos de escrita no segmento `/admin`; reuso de `requireEditor`/`getAuthenticatedEditor`.
- **Rota**: adotar `/admin/resenhas/nova` (resolve a divergência `novo`/`nova` do backlog do STATE — concordância com "resenha").
- **Reuso**: `isbn.ts` (REV-13), `BookCover`/`Rating`/tipos derivados do schema; a leitura pública (`review-page`/`review-listing-search`) já consome `book`+`review`+`genre` — o formulário deve gravar de modo compatível com esses selects.
