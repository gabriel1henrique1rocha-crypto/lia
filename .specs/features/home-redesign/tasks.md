# home-redesign — Tasks

| T | Entrega | Requisitos | Status |
|---|---|---|---|
| T1 | Tokens D-13b no `@theme` + aliases remapeados + fontes Fraunces/Atkinson + teste `tokens.test.ts` (literal fora do `@theme`, 39 pares de contraste) | HOME-01..03, 05 | Done |
| T2 | Header marca à esquerda / nav à direita, skip link por token | HOME-06..08 | Done |
| T3 | Queries: `FEATURED_LIMIT` 10, `listDisabilityRows`, busca título OU autor, embed `disabilities:` | HOME-10, 25, 28, 31, C-6 | Done |
| T4 | `DiscoveryCard` + arte determinística + `SynopsisEscape` | HOME-19..24 | Done |
| T5 | `FeaturedStrip` (rAF, cópias client-only, pausa, reduced-motion, faixa estática, foco) | HOME-11..18, 33 | Done |
| T6 | `DisabilityRow` (região rolável, setas condicionais, "Ver todos" nomeado) | HOME-25..28 | Done |
| T7 | `page.tsx` em dois modos + `ListingControls` com `<details>` e "Limpar" | HOME-09, 29..31, 34 | Done |
| T8 | Remoção de `FeaturedCarousel*`/`ReviewCard`; styleguide com tokens e seção "Home — descoberta" | HOME-04, A-11 | Done |
| T9 | Testes: unitários (card, faixa, fileira, página, queries, tokens) + Playwright `home-redesign.spec.ts` | HOME-35 | Done |
| T10 | Roteiro NVDA + VoiceOver (`docs/a11y/roteiro-home-redesign.md`) — **execução manual pendente** | HOME-35 | Roteiro escrito; execução pendente |

## Evidências (2026-09-20)

- `typecheck`, `lint`, `format:check`: verdes. Vitest: 644 aprovados, 0 falhas.
- Playwright (Chromium local, `next dev`): 66/67 — a única falha é o botão do Next.js Dev Tools (`aria-expanded`), que só existe em `next dev`; no CI roda `next start`.
- Lighthouse a11y = **1.0** em `/`, `/styleguide`, `/admin/login`, `/liacast`, `/quem-somos`.
- Consultas novas conferidas contra PostgREST 12 real (Postgres 16 local com as 13 migrations): busca por autor, vírgula/`%`/aspas no termo, filtro por deficiência mantendo todos os termos no card, agrupamento das fileiras e "Outras resenhas".
- **Não verificado aqui:** `next build` (Google Fonts bloqueado neste ambiente) — o CI cobre.
