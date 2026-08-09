# reviews-crud — Context

**Gathered:** 2026-07-10
**Spec:** [.specs/features/reviews-crud/spec.md](spec.md)
**Status:** ✅ **Gray areas de produto RESOLVIDAS** (2026-07-10). Restam **2 itens de Design** (posse de `book` sob RLS; enforcement da nota) — não bloqueiam a revisão da spec. **Aguardando aprovação da spec antes do Design.**

---

## Feature Boundary

Formulário estruturado em `/admin` (atrás de `requireEditor`) para **criar / editar / publicar / despublicar** resenhas no fluxo **rascunho → publicado**, cobrindo o modelo de campos ABNT (ficha bibliográfica + classificação + conteúdo), mapeando uma submissão única para as tabelas **`book` + `review`** existentes, via **client autenticado sob RLS own-or-admin** (D-09/D-10). **Não cria tabelas novas**; campos faltantes entram por migration aditiva `0009`. **Fora:** dashboard completo/UI de delete (`admin-reviews`), moderação e comentários (M3), métricas (pós-MVP).

**Alvo de prazo:** MVP para alunos testarem na **2ª semana de agosto** — preferir o caminho que entrega o **cadastro funcional mais rápido**; empurrar "nice to have" (ex.: upload real de capa) para feature posterior se ameaçar o prazo.

---

## Decisões TRAVADAS (não reabrir)

Vindas do briefing e das ADRs; entram no Design como fixas:

- **D-01 — Nota inteira 0–5** (Aceita nesta feature): sem meio-ponto; elimina o bug histórico do `",5/5"`. → registrada em [DECISIONS.md](../../project/DECISIONS.md). *(Onde enforçar — CHECK no banco × app — é detalhe de Design, não reabre a escala.)*
- **"Sobre o autor/autora" dentro do corpo**, sem campo próprio (`review.body`).
- **Tags ≠ palavras-chave**: **tags filtráveis** (conectam com `review-listing-search`); **palavras-chave não-filtráveis** (SEO/exibição). Dois campos distintos, nunca confundidos.
- **Escrita via `authenticated.ts` sob RLS** (precedente D-09/D-10): **nunca** browser client com JWT; **nunca** `service_role` para escrita normal. Upload/Storage (se houver) via **server action**.
- **DELETE de `review` = admin-only** (herdado da 0008/M2). A **UI** de delete é de `admin-reviews`; a policy já existe.
- **ISBN**: reusar `src/lib/book/isbn.ts` — opcional, validado por checksum se presente, normalizado/formatado (precedente `book-data`).
- **Rota `/admin/resenhas/nova`** (resolve a divergência `novo`/`nova` do backlog do STATE — concordância com "resenha").

---

## Gray Areas de produto — RESOLVIDAS (2026-07-10)

> O usuário decidiu cada uma explicitamente (não-default). Todas priorizam o **cadastro funcional mais rápido** para o alvo de agosto.

### 1. CAPA → **(a) `cover_url` textual agora** ✅
Só o campo textual `book.cover_url` (já existe). **Upload real ao Storage fica para `storage-covers` depois.** Sem coluna nova, sem infra de Storage nesta feature. Resenha sem capa degrada com o placeholder tipográfico.
**Corta por prazo:** upload de arquivo de capa (→ Deferred Ideas).

### 2. TAGS → **(c) só exibição por ora** ✅
Tags **continuam filtráveis por conceito** (decisão travada não muda), mas **nesta feature são guardadas como exibição** — o **comportamento filtrável (query/param/UI na listagem pública) é adiado por completo**. A coluna `review.tags` ainda entra na 0009 (para guardar/exibir).
**Corta por prazo:** filtro por tag na home (→ Deferred Ideas; extensão futura de `review-listing-search`).

### 3. RESENHISTA → **(b) derivado da conta (`editor.name`)** ✅
Sem coluna nova: o resenhista exibido é `editor.name` via `review.editor_id`. **Assinatura pública = quem cadastrou.** Remove `reviewer_name` da 0009.
**⚠️ Consequência para o Design (nova):** a página pública (anon) hoje **não consegue ler `editor`** — a RLS de `editor` (0007) só tem self-read + admin. Para **exibir o resenhista no público**, o Design precisa **expor `editor.name` ao anon** para editores donos de resenha **publicada** (policy pública restrita a `name`/subset seguro, **sem** e-mail) **ou denormalizar o nome no `review` na publicação**. É staff-byline intencional (não fere "sem dados pessoais do público" do PROJECT, que trata de visitantes), mas **precisa de policy/denormalização explícita** — não é automático. **Resolver no Design.**

### 4. PAINEL → **(a) lista mínima em `/admin/resenhas`** ✅
Lista simples das resenhas do editor (own-or-admin) só para navegar até o editar — **sem** filtros/ações em massa/UI de delete (isso é `admin-reviews`). Dá porta de entrada ao ciclo editar/despublicar (REV-24).

---

## Itens de Design ainda pendentes (não são decisão de produto)

### 5. BOOK-WRITE — provisionar escrita de `book` sob RLS *(achado técnico)*
A `security-foundation` (0008) provisionou escrita de **`review`** own-or-admin, mas **não** de **`book`** — não há GRANT nem policy de INSERT/UPDATE de `book` para `authenticated`. O formulário grava **as duas tabelas**, então a 0009 precisa abrir a escrita de `book`. **Questão de modelo:** `book` é **catálogo compartilhado** (qualquer editor ativo cria/edita) ou **posse transitiva** via `review`? Complicação: no INSERT de um `book` novo **ainda não existe** `review` para checar posse (ordem de gravação livro→resenha). **Encaminhamento sugerido (Design):** INSERT de `book` liberado a `is_active_editor()`; UPDATE/DELETE por admin (ou posse transitiva via `review`), espelhando o padrão anti-recursão da 0007/0008. **Não é decisão de produto — é do Design**, mas **precisa constar** para a 0009 nascer completa. **PENDENTE (Design).**

### 6. Enforcement da nota inteira *(detalhe técnico, não reabre D-01)*
`review.rating` é `numeric(2,1)` (aceita `4.0`). Inteiro-só pode ser enforçado com **CHECK** (`rating = trunc(rating)`) **ou** só na validação do app. Antes de um CHECK, **conferir dado legado** em produção (as 4 resenhas seed) para não quebrar a migration. **Encaminhamento:** Design decide; **PENDENTE (Design).**

---

## Specific References

- Resenha real de exemplo (padrão ABNT) como modelo de campos: autor `Sobrenome, Nome` (ex.: `"Hibbert, Talia"`), ficha bibliográfica + classificação + conteúdo + frase de destaque + "para saber mais".
- Precedentes de código a reusar: [`src/lib/book/isbn.ts`](../../../src/lib/book/isbn.ts) (checksum), [`src/lib/supabase/authenticated.ts`](../../../src/lib/supabase/authenticated.ts) + [`src/lib/auth/requireEditor.ts`](../../../src/lib/auth/requireEditor.ts) (gate + client autenticado), migration [`0008_review_editor_write.sql`](../../../supabase/migrations/0008_review_editor_write.sql) (padrão own-or-admin), [`src/lib/review/queries.ts`](../../../src/lib/review/queries.ts) (selects públicos que a escrita precisa manter compatíveis).

---

## Deferred Ideas

Fora de escopo desta feature, preservados (não bloquear o modelo de dados):

- **Upload real de capa** ao Supabase Storage + policies de bucket por papel → `storage-covers` (M2). *(CAPA = opção a: só `cover_url` textual agora.)*
- **Filtro por tag na listagem pública** → extensão de `review-listing-search`. *(TAGS = opção c: guardar/exibir agora, filtrar depois.)*
- Dashboard admin completo (tabela geral, filtros, ações em massa, UI de delete) → `admin-reviews`.
- Gestão de editores na UI → follow-up.

## Cortado por prazo (sinalizado)

Cortes confirmados pelas decisões, **preservados em Deferred Ideas** — nenhum bloqueia o cadastro funcional do MVP para agosto:

- **Upload de capa** (CAPA=a) — só referência textual `cover_url` agora.
- **Filtragem por tag na listagem** (TAGS=c) — tags só guardadas/exibidas nesta feature.
