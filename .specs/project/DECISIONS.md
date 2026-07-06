# DECISIONS — LIA (ADRs)

Registro de decisões arquiteturais. Origem: seção 10 do PRD ([docs/PRD-LIA.md](../../docs/PRD-LIA.md)).

**Status possíveis:** `Aceita` (resolvida) · `A decidir` (proposta, será resolvida na feature indicada).

| ID | Decisão | Status | Resolver em |
|---|---|---|---|
| D-01 | Escala da nota | A decidir | `reviews-crud` (M2) |
| D-02 | Anti-spam de comentários sem login | A decidir | `public-comments` (M3) |
| D-03 | Modelo de indicação (recomendam vs votação) | A decidir | `recommendations` (M3) |
| D-04 | Estratégia de busca | **Aceita** | `review-listing-search` (M1) |
| D-05 | Hospedagem | **Aceita** | `infra-foundation` (M0) |
| D-06 | Linguagem tipada | **Aceita** | `infra-foundation` (M0) |
| D-07 | Versão do Tailwind + estratégia de tokens | **Aceita** | `infra-foundation` (M0) |

---

## D-05 — Hospedagem: Vercel

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** a stack é Next.js (App Router) com SSR/SSG e necessidade de CDN global e deploy contínuo.

**Decisão:** hospedar na **Vercel**.

**Razão:** suporte first-class a Next.js (App Router, SSR/SSG, edge), CDN global e integração direta com o fluxo de deploy via GitHub Actions. Reduz fricção de infra no MVP.

**Trade-off:** acoplamento ao ecossistema Vercel; custo pode escalar com tráfego. Aceitável no MVP.

**Impacto:** pipeline de deploy do M0 mira a Vercel; otimização de imagens e CDN assumidas como nativas da plataforma.

---

## D-06 — Linguagem tipada: TypeScript

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** a base da stack é JavaScript/Node.js. O modelo de dados e os contratos entre camadas (Supabase ↔ Next.js) se beneficiam de tipagem.

**Decisão:** adotar **TypeScript** sobre a base JavaScript.

**Razão:** tipar o modelo de dados e os contratos reduz bugs e melhora a manutenção, respeitando a stack "JavaScript". Recomendado no PRD.

**Trade-off:** passo de build/tipagem adicional e curva inicial. Compensado pela redução de bugs em cascata.

**Impacto:** projeto inicializado em TypeScript no M0; tipos derivados do schema das entidades núcleo; convenção de código em inglês.

---

## D-07 — Versão do Tailwind + estratégia de tokens

**Status:** Aceita · **Data:** 2026-06-07 · **Milestone:** M0 (`infra-foundation`)

**Contexto:** o scaffold precisa fixar a versão do Tailwind, pois ela define a estratégia de tokens (INFRA-07). O export de design oferece dois caminhos: v4 (`@theme`) ou v3 (`var(--token)`).

**Decisão:** adotar **Tailwind v4** com tokens declarados em `@theme` no `globals.css` como **fonte única** (sem `tailwind.config.js`).

**Razão:** padrão recomendado para projetos novos (`create-next-app --tailwind` instala v4); CSS-first elimina a duplicação `:root` ↔ config, satisfazendo INFRA-07 nativamente. Decisão acoplada (DD-2): a escala de espaçamento usa `--spacing: initial` + chaves explícitas `1–9` para honrar o token 1:1 e eliminar a colisão da INFRA-08.

**Trade-off:** v4 é mais novo (menos material legado); a escala numérica do token (`p-8`=64px) diverge da convenção numérica do Tailwind — documentado no `globals.css` e no design.

**Impacto:** `infra-foundation` configura tokens via `@theme`; componentes consomem só tokens; sem segundo arquivo a sincronizar.

---

## D-01 — Escala da nota

**Status:** A decidir · **Resolver em:** `reviews-crud` (M2)

**Contexto:** a resenha tem uma nota exibida na listagem, na página e usada em filtros/ordenação. A escala precisa ser definida antes do CRUD.

**Opções:** (a) 0–5 estrelas com meia estrela, armazenado como número `0.0–5.0`; (b) escala inteira 0–5; (c) escala 0–10.

**Recomendação do PRD:** 0–5 estrelas com meia estrela, armazenar como número (`0.0`–`5.0`).

**Decisão:** _pendente._

---

## D-02 — Anti-spam de comentários sem login (acessível)

**Status:** A decidir · **Resolver em:** `public-comments` (M3)

**Contexto:** comentários são enviados sem autenticação; a proteção anti-spam precisa ser acessível (não pode depender de visão, por WCAG 2.1 AA).

**Opções:** (a) honeypot + rate-limit por hash de IP + moderação obrigatória; (b) CAPTCHA visual (rejeitado por acessibilidade); (c) desafio acessível adicional se necessário.

**Recomendação do PRD:** honeypot + rate-limit por hash de IP + moderação obrigatória; evitar CAPTCHA visual; desafio acessível só se necessário.

**Decisão:** _pendente._

---

## D-03 — Modelo de indicação: "leitores recomendam" vs votação

**Status:** A decidir · **Resolver em:** `recommendations` (M3)

**Contexto:** a seção de indicações pode ser submissão de conteúdo ("leitores recomendam") ou votação em resenhas existentes. A escolha afeta moderação e modelo de dados (`recommendation`).

**Opções:** (a) votação/recomendação em resenhas existentes, sem login, com controle por rate-limit/fingerprint; (b) submissão aberta "leitores recomendam".

**Recomendação do PRD:** votação/recomendação em resenhas existentes no MVP (mais simples, menos moderação); submissão "leitores recomendam" fica para fase futura.

**Decisão:** _pendente._

---

## D-04 — Estratégia de busca

**Status:** Aceita · **Data:** 2026-07-06 · **Milestone:** M1 (`review-listing-search`)

**Contexto:** a listagem precisa de busca por título e filtros combináveis. A abordagem afeta o schema e a infra.

**Opções:** (a) Postgres full-text search / `ilike` no Supabase no MVP; (b) busca avançada / serviço dedicado (fase futura); (c) busca client-side sobre dados carregados (rejeitada — quebra o DoD de a11y sem-JS e a paginação real).

**Decisão:** **server-side no Supabase via `ilike`** (`%termo%`, case-insensitive), alvo **só `review.title`** (C-1 — autor/gênero são FILTROS, não busca textual). Filtros/ordenação/paginação compõem na mesma query, via cliente **anon** lendo só `status='published'`.

**Razão:** única opção que honra o DoD de a11y (busca/filtros funcionam **sem JS**, via `searchParams` na URL) e a paginação real (`range` + `count`); RLS permanece o gate na origem. Recomendação do PRD.

**Trade-off (registrado):** `ilike '%termo%'` **não usa índice B-tree** — full scan na tabela. Irrelevante no volume do MVP; **migrar para Postgres full-text (tsvector) ou `pg_trgm` quando o volume justificar** (evolução aditiva, sem quebrar o contrato da query).

**Impacto:** `listPublishedReviews(params)` na camada de query; home lê `searchParams`; controles como form GET + links (progressive enhancement).
