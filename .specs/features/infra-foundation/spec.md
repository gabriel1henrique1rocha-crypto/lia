# infra-foundation — Especificação

> Milestone **M0 — Fundação**. Fonte de verdade: [PRD](../../../docs/PRD-LIA.md) (seções 8, 9) e [ROADMAP](../../../docs/ROADMAP.md) (M0).
> Documentação em português; nomes de feature, schema, identificadores e código em inglês.

## Problem Statement

O LIA ainda não tem repositório de aplicação — só documentação e exports de design. Sem uma fundação tipada, com banco modelado, design system aplicado e CI que reprove regressões de acessibilidade, cada feature posterior repetiria decisões de setup e a acessibilidade (Definition of Done de toda feature) ficaria sem rede de proteção. Esta feature entrega o esqueleto de qualidade do qual M1–M4 dependem.

## Goals

- [ ] Repositório Next.js (App Router) + React + TypeScript executável localmente, com lint e uma página placeholder acessível.
- [ ] Banco Supabase modelado: as 6 entidades núcleo e suas relações via migrations versionadas.
- [ ] Design tokens consumidos de **fonte única** (sem hex duplicado), com a escala de espaçamento e o foco visível corrigidos.
- [ ] Componentes base (button, field, link, card) conformes WCAG 2.1 AA, com as 3 famílias tipográficas self-hosted.
- [ ] Pipeline GitHub Actions verde com gate de **lint, testes, axe e Lighthouse**.
- [ ] Deploy inicial na Vercel no ar.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Telas de feature (review-page, listing, painel) | M1/M2 — aqui só o placeholder |
| Conteúdo de *seed* | M1 (`review-listing-search`/`book-data`) |
| Telas de login e fluxo de auth | M2 (`admin-auth-editors`) — M0 só habilita Supabase Auth + RLS deny-by-default |
| Políticas RLS específicas por papel | M2 — M0 entrega RLS ligado e negando por padrão |
| Finalização da escala de nota (range/meia-estrela) | D-01, resolvida em `reviews-crud` (M2) — coluna criada com default razoável |
| Monitoring (Sentry) e analytics | Fase futura |
| Busca full-text | D-04, `review-listing-search` (M1) |

---

## User Stories

### P1: Scaffold Next.js + React + TypeScript ⭐ MVP

**User Story**: Como desenvolvedor, quero um scaffold Next.js (App Router) tipado com lint, para construir features com SSR/SSG e segurança de tipos desde o primeiro commit.

**Why P1**: É a base de tudo; nenhuma outra story existe sem ela. Concretiza D-06 (TypeScript).

**Acceptance Criteria**:

1. QUANDO o repositório é instalado e `dev` é executado ENTÃO o sistema DEVE servir um app Next.js com App Router e React em TypeScript (`strict: true`).
2. QUANDO o lint é executado ENTÃO o sistema DEVE rodar ESLint + formatação sem erros no código de fundação.
3. QUANDO a rota raiz é aberta ENTÃO o sistema DEVE renderizar uma página placeholder com `html[lang="pt-BR"]`, landmark `main`, skip link funcional e hierarquia de headings correta.
4. QUANDO o build de produção é executado ENTÃO o sistema DEVE concluir sem erros de tipo nem de build.

**Independent Test**: clonar, instalar, `dev` → abrir a raiz e navegar por teclado (Tab revela skip link, foco visível); `build` conclui limpo.

---

### P1: Banco Supabase — schema e migrations das entidades núcleo ⭐ MVP

**User Story**: Como desenvolvedor, quero o Postgres do Supabase modelado por migrations versionadas para que as features de leitura e admin tenham o modelo de dados pronto e consistente.

**Why P1**: M1–M3 leem e escrevem nessas tabelas; o modelo precisa existir antes.

**Acceptance Criteria**:

1. QUANDO as migrations são aplicadas ENTÃO o sistema DEVE criar as tabelas `book`, `review`, `comment`, `editor`, `recommendation` e `genre` com os campos do PRD (seção 9), nomes em inglês.
2. QUANDO o schema é inspecionado ENTÃO as relações DEVEM existir: `review` 1—1 `book` (FK única `review.book_id`), `review` 1—N `comment`, `review` 1—N `recommendation`, `editor` 1—N `review`, `genre` 1—N `book`.
3. QUANDO os campos de status são criados ENTÃO o sistema DEVE usar tipos enumerados: `review.status` (`draft`|`published`), `comment.status` (`pending`|`approved`|`rejected`), `editor.role` (`admin`|`editor`).
4. QUANDO um `recommendation` é inserido ENTÃO o sistema DEVE garantir unicidade por `(review_id, voter_hash)` (um voto por visitante).
5. QUANDO um `review` é criado ENTÃO `slug` DEVE ser único e `comment.author_name` opcional; `comment.ip_hash` e `recommendation.voter_hash` armazenam apenas hash (sem PII).
6. QUANDO o RLS é verificado ENTÃO todas as tabelas DEVEM ter Row Level Security **habilitado e negando por padrão** (políticas específicas por papel ficam para M2).
7. QUANDO `editor` é modelado ENTÃO DEVE referenciar o usuário de auth do Supabase (perfil ligado a `auth.users`).

**Independent Test**: aplicar migrations num projeto limpo, inspecionar o schema (tabelas, FKs, enums, unique, RLS on) e tentar inserir duplicata de voto → rejeitada.

> Dependência de decisão: `review.rating` é criada como `numeric(2,1)` com `CHECK (rating >= 0 AND rating <= 5)` seguindo a recomendação de **D-01**; o range/meia-estrela final é confirmado em `reviews-crud` (M2).

---

### P1: Design tokens como fonte única ⭐ MVP

**User Story**: Como desenvolvedor, quero os design tokens de [lia-tokens.css](../../../docs/design/lia-tokens.css) consumidos de uma fonte única, para que cor, tipografia, espaçamento, raio e foco nunca divirjam entre CSS e config.

**Why P1**: Todos os componentes e telas dependem dos tokens; duplicação de hex gera divergência e quebra de contraste/acessibilidade.

**Acceptance Criteria**:

1. QUANDO o scaffold é criado ENTÃO a versão do Tailwind DEVE ser confirmada e registrada (ADR/STATE).
2. QUANDO a versão é **Tailwind v4** ENTÃO os tokens DEVEM ser declarados via `@theme` no CSS de entrada como fonte única.
3. QUANDO a versão é **Tailwind v3** ENTÃO o `tailwind.config` DEVE referenciar `var(--token)` (não hex duplicado), com os tokens definidos uma única vez em `:root`.
4. QUANDO qualquer token muda em um lugar ENTÃO o valor DEVE propagar sem edição em segundo arquivo (zero hex duplicado entre fontes).
5. QUANDO os tokens são aplicados ENTÃO os pares de contraste anotados no export DEVEM ser preservados (texto AA ≥ 4.5:1; UI ≥ 3:1).

**Independent Test**: alterar um token (ex.: `--oxblood-700`) num único arquivo e ver botão primário e link refletirem a mudança; `grep` por hex duplicado não encontra colisão entre fontes.

---

### P1: Correção da escala de espaçamento ⭐ MVP

**User Story**: Como desenvolvedor, quero a escala de espaçamento do token sem mistura com os defaults do Tailwind, para que `p-5`/`gap-6` etc. tenham sempre o valor do design system.

**Why P1**: Em [tailwind.config.js:139](../../../docs/design/tailwind.config.js#L139) a escala está em `theme.extend.spacing`, então faz *merge* com os defaults — as chaves 5–8 colidem com valores diferentes (custom `5`=24px vs default `5`=20px; custom `8`=64px vs default `8`=32px) e defaults como `10/11/12` sobrevivem. Layout fica imprevisível.

**Acceptance Criteria**:

1. QUANDO a escala de espaçamento é configurada ENTÃO o sistema DEVE **substituir** a escala default (definir em `theme.spacing`, não `theme.extend.spacing`) **ou** usar um namespace próprio sem colisão.
2. QUANDO uma classe de espaçamento é usada ENTÃO não DEVE existir nenhuma chave com valor diferente do token (sem `1..9` com significado duplo, sem defaults residuais conflitantes).
3. QUANDO a decisão é tomada ENTÃO DEVE estar documentada (comentário no config + nota em STATE).

**Independent Test**: inspecionar o tema resolvido do Tailwind — a escala de spacing bate 1:1 com os tokens, sem chaves default conflitantes.

---

### P1: Correção do foco visível (raio no anel, não no elemento) ⭐ MVP

**User Story**: Como usuário de teclado, quero que o anel de foco apareça nítido sem deformar o componente, para que o foco seja claro (WCAG 2.4.7 / 1.4.11) sem efeitos colaterais visuais.

**Why P1**: [lia-tokens.css:217-221](../../../docs/design/lia-tokens.css#L217-L221) e [tailwind.config.js:217-221](../../../docs/design/tailwind.config.js#L217-L221) aplicam `border-radius` no **elemento** dentro do `:focus-visible`, mudando a geometria do elemento ao focar (um card de raio 10px é forçado a 4px; um elemento reto vira arredondado só no foco).

**Acceptance Criteria**:

1. QUANDO um elemento recebe foco via teclado ENTÃO o estilo de foco NÃO DEVE alterar o `border-radius` próprio do elemento.
2. QUANDO o anel é desenhado ENTÃO o arredondamento DEVE derivar do raio intrínseco do elemento (outline acompanha o elemento) **ou** do anel por `box-shadow` (variante `focus-ring-shadow`) para cantos grandes.
3. QUANDO o foco aparece ENTÃO DEVE manter largura 3px, folga 2px e cor `--focus-blue` (contraste ≥ 3:1).
4. QUANDO o usuário interage por mouse ENTÃO o anel NÃO DEVE poluir o clique (`:focus-visible`, não `:focus`).

**Independent Test**: focar via Tab um card (raio 10px) e um botão — o anel envolve o componente sem mudar seu raio; clicar com mouse não dispara o anel.

---

### P1: Tipografia self-hosted via next/font ⭐ MVP

**User Story**: Como leitor (inclusive em conexões lentas), quero as fontes servidas pelo próprio site, para leitura estável, rápida e sem dependência de terceiros.

**Why P1**: Performance (Core Web Vitals) e privacidade; os tokens já assumem Spectral/Newsreader/IBM Plex Sans.

**Acceptance Criteria**:

1. QUANDO a página carrega ENTÃO as famílias **Spectral** (display), **Newsreader** (body) e **IBM Plex Sans** (ui) DEVEM ser self-hosted via `next/font` (sem requisição a CDN de fontes externo).
2. QUANDO as fontes carregam ENTÃO NÃO DEVE haver layout shift perceptível (CLS < 0,1; estratégia de `display` e fallback métrico adequados).
3. QUANDO um token de família é usado ENTÃO DEVE mapear para a fonte self-hosted correspondente (`--font-display`/`--font-body`/`--font-ui`).

**Independent Test**: carregar com aba de rede → fontes vêm do próprio domínio; medir CLS ≈ 0 na troca de fonte.

---

### P1: Componentes base acessíveis ⭐ MVP

**User Story**: Como desenvolvedor, quero button, field, link e card prontos e acessíveis (referência [lia-components.css](../../../docs/design/lia-components.css)), para montar telas sem reimplementar a11y a cada vez.

**Why P1**: M1–M3 montam UI sobre esses blocos; a acessibilidade precisa nascer aqui.

**Acceptance Criteria**:

1. QUANDO os componentes são renderizados ENTÃO **button**, **field**, **link** e **card** DEVEM existir como componentes React tipados, consumindo apenas tokens.
2. QUANDO um **field** está em erro ENTÃO DEVE expor `aria-invalid="true"`, mensagem com `role="alert"`, ícone **e** texto (nunca só cor), e `label` associado ao controle.
3. QUANDO um **link** é renderizado ENTÃO DEVE ser sempre sublinhado (significado não depende só de cor).
4. QUANDO qualquer controle interativo recebe foco ENTÃO DEVE exibir o anel de foco corrigido (story anterior).
5. QUANDO um **button**/controle é alvo de toque ENTÃO DEVE respeitar o alvo mínimo de 44px (`--target-min`) no tamanho padrão.
6. QUANDO um **card** é clicável inteiro ENTÃO DEVE ser focável e operável por teclado com foco visível.
7. QUANDO os componentes são auditados ENTÃO DEVEM passar axe sem issues críticos e atender contraste AA.

**Independent Test**: renderizar cada componente numa página de demonstração; navegar por teclado e com leitor de tela; disparar erro no field e ouvir o `role="alert"`; axe sem críticos.

---

### P1: Ícones Lucide

**User Story**: Como desenvolvedor, quero um set de ícones consistente (Lucide) para os componentes (erro do field, chevron do select, ícone de link externo, ícone em botão).

**Why P1**: Os componentes base referenciam ícones; sem eles o field/select/link ficam incompletos.

**Acceptance Criteria**:

1. QUANDO um componente usa ícone ENTÃO DEVE usar **Lucide** (via `lucide-react`).
2. QUANDO um ícone é puramente decorativo ENTÃO DEVE ter `aria-hidden="true"` e não receber foco.
3. QUANDO um ícone carrega significado isolado ENTÃO DEVE ter rótulo textual acessível associado.

**Independent Test**: inspecionar o field em erro (ícone `aria-hidden`, texto comunica o erro) e o select (chevron decorativo).

---

### P1: CI no GitHub Actions com gate de qualidade ⭐ MVP

**User Story**: Como time, quero que todo PR passe por lint, testes, axe e Lighthouse, para que regressões de qualidade e acessibilidade sejam barradas antes do merge.

**Why P1**: Acessibilidade é Definition of Done de toda feature; o gate é o que torna isso executável (PRD seção 3).

**Acceptance Criteria**:

1. QUANDO um PR é aberto contra `main` ENTÃO o workflow DEVE executar lint, testes, axe e Lighthouse.
2. QUANDO o lint falha ou um teste quebra ENTÃO o pipeline DEVE reprovar (status vermelho, merge bloqueado).
3. QUANDO o axe encontra **qualquer issue crítico** ENTÃO o pipeline DEVE reprovar (meta: 0 críticos).
4. QUANDO o Lighthouse roda na página placeholder ENTÃO a categoria **Accessibility** DEVE atingir 100 (ou o threshold configurado) sob pena de reprovar.
5. QUANDO o pipeline conclui com sucesso ENTÃO DEVE reportar status verde rastreável ao commit.

**Independent Test**: abrir PR com violação de a11y deliberada → pipeline vermelho no passo axe/Lighthouse; corrigir → verde.

---

### P2: Deploy inicial na Vercel

**User Story**: Como time, quero a página placeholder publicada na Vercel, para validar o caminho de deploy ponta a ponta (concretiza D-05).

**Why P2**: É a "saída no ar" do M0, mas depende do scaffold/CI estarem verdes primeiro; não bloqueia o desenvolvimento local das demais stories.

**Acceptance Criteria**:

1. QUANDO o projeto é conectado à Vercel ENTÃO as variáveis de ambiente (Supabase URL/keys) DEVEM estar configuradas no ambiente correto.
2. QUANDO um push em `main` ocorre ENTÃO a Vercel DEVE fazer build e publicar a página placeholder acessível.
3. QUANDO a URL de produção é aberta ENTÃO a página DEVE responder com a11y preservada (mesmos critérios do placeholder local).

**Independent Test**: acessar a URL de produção da Vercel e rodar axe/Lighthouse contra ela.

---

## Edge Cases

- QUANDO variáveis de ambiente do Supabase estão ausentes ENTÃO o app DEVE falhar com erro claro de configuração (não silencioso).
- QUANDO `prefers-reduced-motion` está ativo ENTÃO transições/animações DEVEM ser neutralizadas (já previsto nos tokens).
- QUANDO o usuário aumenta o zoom/tamanho de fonte (até 200%) ENTÃO o layout DEVE permanecer utilizável (escala em rem).
- QUANDO uma migration é reaplicada ENTÃO DEVE ser idempotente/segura (sem corromper dados existentes).
- QUANDO um voto/`recommendation` duplicado do mesmo `voter_hash` chega ENTÃO o banco DEVE rejeitar pela constraint única.
- QUANDO o JavaScript está desabilitado ENTÃO a página placeholder (SSR) DEVE renderizar conteúdo e landmarks.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| INFRA-01 | Scaffold Next.js + React + TS | T-01 | Pending |
| INFRA-02 | Lint + formatação | T-01 | Pending |
| INFRA-03 | Página placeholder acessível (lang, landmarks, skip link) | T-05, T-08 | Pending |
| INFRA-04 | Projeto Supabase + env + client tipado | T-02 | Pending |
| INFRA-05 | Schema & migrations das 6 entidades + relações + enums + unique | T-03 | Pending |
| INFRA-06 | RLS habilitado, deny-by-default | T-03 | Pending |
| INFRA-07 | Design tokens fonte única (Tailwind v4 @theme) | T-04 | Pending |
| INFRA-08 | Correção da escala de espaçamento | T-04 | Pending |
| INFRA-09 | Correção do foco visível (raio no anel) | T-04 | Pending |
| INFRA-10 | Fontes self-hosted via next/font (3 famílias, sem CLS) | T-05 | Pending |
| INFRA-11 | Componentes base (button, field, link, card) WCAG 2.1 AA | T-06 | Pending |
| INFRA-12 | Padrão de erro do field (aria-invalid + role=alert + ícone + texto) | T-06 | Pending |
| INFRA-13 | Ícones Lucide (decorativos aria-hidden) | T-06 | Pending |
| INFRA-14 | CI: gate de lint + testes | T-09 | Pending |
| INFRA-15 | CI: gate axe (0 críticos) | T-07, T-09 | Pending |
| INFRA-16 | CI: gate Lighthouse Accessibility (=100/threshold) | T-07, T-09 | Pending |
| INFRA-17 | Deploy inicial na Vercel (env, build verde) | T-10 | Pending |

**Coverage:** 17 requisitos · 17 mapeados para tasks ✅

---

## Success Criteria

- [ ] `dev` e `build` rodam limpos; página placeholder acessível navegável por teclado e leitor de tela.
- [ ] Migrations criam as 6 entidades com relações, enums, unique e RLS habilitado num projeto Supabase limpo.
- [ ] Zero hex duplicado entre fontes de token; alterar um token propaga sozinho.
- [ ] Escala de espaçamento sem colisão com defaults do Tailwind; foco visível não deforma o elemento.
- [ ] 3 famílias self-hosted via next/font; CLS < 0,1 na página placeholder.
- [ ] button/field/link/card passam axe sem críticos e atendem contraste AA; field em erro anuncia via `role="alert"`.
- [ ] Pipeline GitHub Actions verde com gates de lint, testes, axe (0 críticos) e Lighthouse Accessibility = 100.
- [ ] URL de produção na Vercel no ar com a11y preservada.
