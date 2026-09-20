# home-redesign — Design (compacto)

**Aprovado por:** Gabriel, 2026-09-20 ("pode executar") — spec aprovada com as recomendações de C-1..C-12.
**C-8** (subtítulo da marca) ficou sem recomendação no spec: mantido **só "OLDA"** (estado de produção), reabrível sem custo.

## Decisões de C-n aplicadas

| C | Aplicado |
|---|---|
| C-1 | `<h1>` "Observatório Anticapacitista de Literatura e Deficiência" + subtítulo atual. |
| C-2 | gênero/autor/ordem num `<details>` "Mais filtros" (abre sozinho se um deles está ativo). |
| C-3 | `FEATURED_LIMIT = 10`. |
| C-4 | Fileira "Outras resenhas" por último, sem "Ver todos". |
| C-5 | Faixa "Em destaque" some no modo busca. |
| C-6 | Busca em título **ou** autor; rótulo "Buscar por título ou autor". |
| C-7 | Seção `h2` "Resenhas" (`#resenhas`). |
| C-8 | Marca = "OLDA" (sem subtítulo). |
| C-9 | Kicker "Gênero · Ano". |
| C-10 | Pausa em `sessionStorage` (`olda:destaques-pausados`), com try/catch. |
| C-11 | Critérios 2.2 (2.4.11, 2.5.8) aplicados aqui; adoção geral registrada em D-13. |
| C-12 | `ROW_LIMIT = 12`. |

## Pontos de auditoria resolvidos

- **A-1/A-2** — rótulos e rodapé de produção mantidos.
- **A-3** — `--type-label`, `.lia-btn`, `.lia-field__error`, cabeçalho de linha do admin: 500 → 700.
- **A-4** — `--text-muted` = `--color-ink-soft`.
- **A-5** — arte do fallback: `--color-art-1..14` + 3 tons das formas; o componente só emite `data-tone` (1..14); a cor vem do CSS.
- **A-6** — título limitado a 3 linhas; legenda ancorada na base.
- **A-7** — wrapper `role="region"` + `aria-label` + `tabIndex=0` (removido do Tab quando medido e sem overflow); `<ul>` intacto.
- **A-8** — cada fileira é `div` (não `section` nomeada): 12 landmarks a mais com o mesmo nome da região rolável quebrariam `landmark-unique`. Títulos de card seguem como heading (h3 no destaque, h4 nas fileiras e na grade).
- **A-10** — `--focus-ring-offset` redefinido dentro da faixa e do form (fundo `band`).
- **A-11** — `FeaturedCarousel*` e `ReviewCard` removidos (sem outro consumidor).
- **A-12** — `listDisabilityRows`: UMA consulta (até 500 publicadas) + agrupamento no servidor.
- **A-13** — `instanceId` por instância; teste garante ids únicos.

## Arquitetura

```
page.tsx (server)
 ├─ Hero (h1)
 ├─ FeaturedStrip ('use client', SSR) ─ só no modo navegação
 │    ├─ grupo original (SSR)            → DiscoveryCard lg h3
 │    └─ grupo cópia (só após montar)    → DiscoveryCard inert, aria-hidden
 ├─ section#resenhas (h2 "Resenhas")
 │    ├─ ListingControls (server, form GET, <details> "Mais filtros")
 │    ├─ modo navegação: DisabilityRow ('use client', SSR) × N → DiscoveryCard sm h4
 │    └─ modo busca: "Resultados" (h3) + ResultsCount + grade + Pagination
 └─ SynopsisEscape ('use client', ouvinte único de Esc no document)
```

- **Modo** = mesmo predicado do `noindex` (`hasActiveParams`). Navegação consulta `listFeaturedReviews` + `listDisabilityRows` + `listFilterOptions`; busca consulta `listFilterOptions` + `listPublishedReviews`.
- **`LIST_SELECT`** ganhou `book.year`, `book.cover_url` e o embed com alias `disabilities:` (exibição). O filtro por deficiência usa um SEGUNDO embed `filtro:…!inner` — assim o card mostra todos os termos mesmo com filtro ativo (conferido contra PostgREST real).
- **Busca por autor**: `book.id` via `ilike` em `book`, depois `or(title.ilike."…",book_id.in.(…))`; valor entre aspas com `\` e `"` escapados (conferido contra PostgREST real: vírgula, `%` e aspas no termo).
- **Movimento**: `requestAnimationFrame` só existe enquanto `montado && !reduzido && transborda`; para com hover, foco dentro, aba oculta (`visibilitychange`), fora da viewport (`IntersectionObserver`), 900 ms após ação manual (roda, toque, tecla, setas) e pausa do botão.
- **Foco (HOME-17)**: o navegador não rola um card "meio visível" sob a máscara. `onFocus` → no quadro seguinte, o card focado é trazido para dentro de `scroll-padding-inline`. Em faixa estreita, a largura do card grande é limitada por container query (`100cqi`) para caber inteiro entre as máscaras.
- **`useMounted` / `useReducedMotion`** via `useSyncExternalStore`: nada dependente de JS sai no HTML do servidor, sem setState em efeito.
