# HOME — `home-redesign` (repaginação da home + nova identidade visual)

**Marco:** M4 · **Fase:** Specify — **aguardando aprovação** · **ADR:** [D-13 (Proposta)](../../project/DECISIONS.md#d-13--home-carrossel-com-movimento-automático-e-nova-identidade-visual)
**Referência visual/comportamental:** [`docs/design/home-redesign-prototype.dc.html`](../../../docs/design/home-redesign-prototype.dc.html) — protótipo aprovado no Claude Design. **Não é código de produção** (runtime próprio do Claude Design): é alvo, não fonte. Nada dele é importado ou portado literalmente.
**Substitui:** LST-16 (via D-13). **Afeta:** LST-01/02/03/05/08/09/12/17/18/26 (§6).

## 1. Problema

A home atual é uma grade de busca com um carrossel de 4 destaques que só anda por clique. O
protótipo aprovado propõe uma home de **descoberta**: faixa de destaques em movimento contínuo,
fileiras por deficiência representada (o eixo editorial de D-12) e cards com ilustração e
sinopse — e uma identidade visual nova (Fraunces + Atkinson Hyperlegible, paleta creme/verde)
que passa a valer para o site inteiro.

As duas mudanças tocam requisito travado (LST-16) e tokens globais (que alimentam o gate
`axe + lighthouse` de todas as rotas), por isso nascem com ADR (D-13).

## 2. Escopo

**Dentro:** tokens e fontes globais; header; hero com `<h1>`; carrossel "Em destaque" com
movimento automático; card novo (ilustração + título sobreposto + sinopse); fileiras por termo
de deficiência; busca/grade com o visual novo; estados (§5); impacto verificado nas rotas já
existentes.

**Fora:** upload/edição de capa (a ilustração usa `cover_url` como está — **sem migration**);
rodapé com links novos (Acessibilidade/Contato — rotas não existem, ver A-2); página por termo;
Filmografia; qualquer filtragem no cliente.

## 3. Estado atual verificado (`main` @ 5dadfa7)

- `src/app/page.tsx`: SSR, estado 100% na URL (`q`, `genero`, `autor`, `deficiencia`, `ordem`, `pagina`), form GET, sem JS; `generateMetadata` com canonical `/` e `noindex` quando há param ativo (`hasActiveParams`); falha de leitura degrada sem 500.
- `FeaturedCarousel` + `FeaturedCarouselControls`: 4 destaques (`listFeaturedReviews().limit(4)`), setas + dots, `role="status"` "Destaque n de N", sem timer por construção (LST-16, DD-5).
- `ReviewCard` + `BookCover` (`cover_url` → `<img>`; sem cover → capa tipográfica). 100% das resenhas em produção estão no fallback.
- `ReviewListItem`: `excerpt` (derivado do `body` no servidor), `book.author`, `book.genre`. Deficiência via `review_disability`/`disability_term` (D-12, 0013).
- Header em `layout.tsx` + `SiteNav` (6 destinos, `aria-current`, flex-wrap, sem hambúrguer). Rótulos atuais: Quem somos · Autores com deficiência · **Resenhas** · Filmografia · LIACast · **Sugestões LIA**.
- Tokens: primitivos no `@theme` (paper/ink/oxblood/sage + feedback red/green/amber/blue + `focus-blue`); **aliases semânticos** em `:root` (`--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--focus-*`) consumidos por todas as rotas. Fontes Spectral/Newsreader/IBM Plex Sans via `next/font`.

## 4. Requisitos

### 4.1 Identidade visual e tokens (site inteiro)

- **HOME-01 — Tokens.** A paleta do protótipo entra como primitivos no `@theme` e os aliases semânticos são **remapeados** (não duplicados). Nenhum hex fora do `@theme` em `src/` (incl. `rgba()` com cor literal) — verificado por teste que varre `src/**/*.{ts,tsx,css}` fora do bloco `@theme`. Mapeamento mínimo: `surface-page`=ground `#F6F1E7`, `surface-subtle`=band `#ECE3D1`, `border-subtle`=divisória `#D9CFBC`, `surface-card`/campo=`#FFFDF8`, `text-strong`=ink `#1D1A16`, `text-secondary` **e** `text-muted`=`#5A5247` (A-4), `border-field`=`#6E6557`, `text-link`/`action-primary-bg`/`focus-ring`=`#0F5E5A`, `*-hover`=`#0A4441`, `surface-inverse`=card escuro `#2B2620`, `overlay-synopsis`=`rgba(29,26,22,.97)`, `scrim`=`rgba(20,17,13,α)`, paleta de arte do fallback (A-5). Primitivos antigos (paper/ink/oxblood/sage/focus-blue) **saem**; feedback (red/green/amber/blue) **fica** (A-9).
- **HOME-02 — Fontes.** Fraunces (display; 500/600) e Atkinson Hyperlegible (corpo e UI; 400/700, itálico 400) via `next/font/google`, `display: swap`, subsets `latin` + `latin-ext`. Spectral, Newsreader e IBM Plex Sans removidas do bundle. `--font-display`→Fraunces; `--font-body` e `--font-ui`→Atkinson. Peso 500 em UI não existe na Atkinson → tokens de peso remapeados (A-3).
- **HOME-03 — Contraste.** Todo par texto/fundo ≥ **4.5:1** (1.4.3) e todo par não-texto que identifica controle/estado ≥ **3:1** (1.4.11), conforme §7. Teste unitário calcula as razões a partir dos **valores dos tokens** (não de hex copiado no teste) e falha abaixo do limite.
- **HOME-04 — Impacto nas rotas existentes.** Com os tokens novos, `axe` 0 violações e Lighthouse a11y **= 1.0** continuam valendo em `/`, `/resenha/[slug]`, `/admin/login`, `/admin/resenhas`, `/admin/resenhas/nova`, `/admin/resenhas/[id]/editar`, `/styleguide` e nos placeholders (`/quem-somos`, `/autores`, `/filmografia`, `/sugestoes`, `/liacast`). `/styleguide` é atualizado para documentar os tokens novos. Nenhuma rota fica com cor/fonte antiga.
- **HOME-05 — Foco.** Indicador `outline: 3px solid var(--focus-ring)` com `outline-offset: 3px` em todo elemento focável (2.4.7); ≥ 3:1 contra as cores adjacentes em cada fundo onde aparece (ground, band — §7; A-10). Card: anel no `<article>` via `:has(.card-link:focus-visible)`, o link em si sem outline próprio.
- **HOME-06 — Alvo de toque.** Todo controle interativo da home (links do nav, setas, pausa, "Ver todos", campos, botões, cards) ≥ **44×44 px** CSS (acima do 2.5.8 AA; alinhado ao 2.5.5).

### 4.2 Estrutura da página

- **HOME-07 — Header.** Marca à esquerda (link para `/`, nome acessível começa com "OLDA"), `SiteNav` à direita com os 6 destinos. `SiteNav` mantém `aria-current="page"`, landmark único `navigation` "Principal", flex-wrap e **sem hambúrguer**; em viewport estreito, marca e nav empilham e a lista quebra em linhas. Rótulos **de produção** (Resenhas, Sugestões LIA), não os do protótipo (A-1).
- **HOME-08 — Semântica.** Um único `<h1>` na página (hero). Landmarks: `banner`, `navigation` "Principal", `main#main`, `search`, `contentinfo`. Hierarquia: `h1` → `h2` "Em destaque" / `h2` da seção de resenhas (C-7) → `h3` por fileira ou "Resultados" → título do card no nível seguinte (A-8). Skip link do layout continua levando a `#main`.
- **HOME-09 — Hero.** `<h1>` + subtítulo centralizados (copy em C-1), em Fraunces 600. Reflow sem truncar a 320 px.

### 4.3 Carrossel "Em destaque" (D-13 substitui LST-16)

- **HOME-10 — Fonte dos destaques.** `listFeaturedReviews` passa de 4 para **N** (C-3; proposta: 10), mais recentes por `published_at`, filtro `status='published'` explícito (LST-20). Sem coluna nova (LST-18).
- **HOME-11 — Sem JS.** O HTML do servidor entrega a **lista única** (sem cópias) num viewport rolável horizontalmente; cada card é um link focável e a rolagem acompanha o Tab. Setas e botão de pausa **não aparecem** sem JS (não há controle morto na tela): renderizados só após montar no cliente.
- **HOME-12 — Movimento automático.** Com JS e sem `prefers-reduced-motion`, a faixa rola continuamente por `scrollLeft` + `requestAnimationFrame` (não `transform`), para que o foco por Tab traga o card para a vista. Loop infinito por **cópias renderizadas só no cliente**: segundo grupo com `aria-hidden="true"`, links `tabIndex={-1}`, **sem `id`s duplicados** e sem `aria-describedby`. Velocidade padrão 28 px/s (token de configuração, não número mágico no componente).
- **HOME-13 — Pausar/Retomar (2.2.2).** Botão visível com ícone + texto "Pausar"/"Retomar"; nome acessível **contém o texto visível** (2.5.3) — ex.: "Pausar carrossel". O movimento também para, sem mexer no estado do botão, enquanto: o ponteiro está sobre a faixa; o foco está dentro dela; a aba está oculta (`visibilitychange`); a faixa está fora da viewport (`IntersectionObserver`); e por ~900 ms após uma ação manual (seta ou rolagem). Retomar continua da posição atual (não volta ao início). Persistência da pausa entre visitas: C-10.
- **HOME-14 — `prefers-reduced-motion: reduce`.** Sem movimento automático, **sem botão de pausa**, sem cópias; setas e rolagem manual continuam; `scrollBy` com `behavior: 'auto'`. Mudança da preferência com a página aberta é aplicada ao vivo (listener no `matchMedia`).
- **HOME-15 — Faixa que não enche a viewport.** Se a largura do grupo original ≤ largura do viewport: sem cópias, sem animação, sem pausa, sem setas (faixa estática). Recalculado em `resize` (ex.: zoom).
- **HOME-16 — Setas.** "Destaques anteriores" / "Próximos destaques" (`aria-label`), avançam ~2 cards, com wrap no loop; contam como ação manual (HOME-13).
- **HOME-17 — Foco não obscurecido (2.4.11).** `scroll-padding-inline` do viewport **maior** que a largura da máscara de borda (protótipo: 96 px vs 56 px), de modo que um card focado nunca fique sob o degradê. Como o foco dentro pausa o movimento (HOME-13), o card focado não sai de vista sozinho.
- **HOME-18 — Sem anúncio contínuo.** Removidos o `role="status"` "Destaque n de N" e os indicadores de posição (dots): com movimento automático seriam ruído permanente para o leitor de tela (afeta LST-17, §6).

### 4.4 Card

- **HOME-19 — Anatomia.** `<article>` com: ilustração (`cover_url` → `<img alt="">` decorativa, pois o título é texto; sem cover → fallback tipográfico **escuro com formas abstratas `aria-hidden`**, cor/formas determinísticas a partir do id da resenha, cores do token de arte — A-5); degradê (`scrim`); "kicker" (C-9); título como **texto real** dentro de um link; linha de apoio abaixo do card (autor · ano) nas fileiras e na grade.
- **HOME-20 — Título legível em qualquer imagem (1.4.3).** Texto claro sobre o `scrim`; toda a legenda fica na zona em que o degradê garante ≥ 4.5:1 mesmo sobre imagem branca (α ≥ 0,61 — A-6); título limitado a 3 linhas com reticências.
- **HOME-21 — Sinopse no hover e no foco (1.4.13).** A camada de sinopse (título, autor · ano, termo(s) de deficiência, `excerpt` limitado em linhas, "Ler resenha →") aparece com `:hover` e com foco no link. É **dispensável**: Esc a esconde (listener no `document`, porque com hover puro o foco não está no card) até o ponteiro/foco sair; **hoverable**: continua aberta com o ponteiro sobre ela; **persistente**: não some por tempo. Duplicatas visuais (título, "Ler resenha") `aria-hidden`.
- **HOME-22 — Sinopse para leitor de tela.** O link tem `aria-describedby` apontando para a camada (id único por **instância** — a mesma resenha pode aparecer no destaque e em várias fileiras). Sem `excerpt` e sem termo → sem `aria-describedby`.
- **HOME-23 — Card inteiro clicável, uma parada de Tab.** Área de clique pelo `::after` do link (padrão atual do `ReviewCard`); nenhum outro focável dentro do card; a camada de sinopse não intercepta clique (`pointer-events: none`).
- **HOME-24 — Toque.** Sem hover, o toque navega para a resenha (a sinopse não é pré-requisito: o conteúdo está na página da resenha).

### 4.5 Fileiras por deficiência (sem busca ativa)

- **HOME-25 — Uma fileira por termo.** Termos **ativos** com ≥ 1 resenha publicada, em `sort_order` (mesma regra de `listFilterOptions`, DIS-07); dentro da fileira, mais recentes primeiro, até **M** itens (C-12; proposta: 12).
- **HOME-26 — Cabeçalho da fileira.** Título do termo como heading (HOME-08); "Ver todos" → `/?deficiencia=<slug>` (filtro existente) com nome acessível que **contém o texto visível** e identifica a fileira (ex.: visível "Ver todos" + texto oculto " — Deficiência física"), para que a lista de links do leitor de tela não tenha N "Ver todos" iguais.
- **HOME-27 — Rolagem.** Região rolável alcançável por teclado **sem JS** (wrapper `role="region"` nomeado com o termo + `tabIndex={0}`, mantendo `<ul>` semântico dentro — A-7); setas "Rolar <termo> para trás/frente" (`aria-label`) só com JS e só quando há overflow; `behavior: 'auto'` sob reduced-motion.
- **HOME-28 — Resenhas sem termo.** Fileira final "Outras resenhas" com as publicadas sem nenhum termo ativo, **sem** "Ver todos" (não há filtro para "sem deficiência") — condicionada a C-4.

### 4.6 Busca (modelo atual preservado, visual novo)

- **HOME-29 — Form.** GET para `/`, SSR, funciona sem JS; `role="search"` nomeado; campo de busca rotulado (texto em C-6), select "Deficiência representada" (DIS-07), botão "Buscar" e "Limpar" como **link** para `/` (funciona sem JS). Visibilidade de `genero`/`autor`/`ordem`: C-2.
- **HOME-30 — Dois modos.** Sem param ativo (mesmo predicado de `hasActiveParams`) → fileiras (§4.5). Com param ativo → grade "Resultados" + contagem (`ResultsCount`, LST-03/23) + paginação com `aria-current` (LST-13) + estado vazio com recuperação (LST-15), no card novo. Hero no modo busca: C-5.
- **HOME-31 — Nada no cliente.** Proibida filtragem/ordenação/paginação só no cliente; todo estado continua na URL; `canonical` `/` e `noindex` com params inalterados.

### 4.7 Qualidade transversal

- **HOME-32 — Reflow e zoom (1.4.10, 1.4.4).** A 320 px CSS e a 200% de zoom: sem rolagem horizontal da **página** (só dentro de faixa/fileiras), header e controles quebram em linhas, nenhum texto cortado; cards mantêm largura fixa e a faixa rola.
- **HOME-33 — Movimento e desempenho.** rAF parado quando a aba está oculta ou a faixa fora da viewport; cópias do loop montadas após hidratação sem causar CLS (altura da faixa definida no SSR); fontes via `next/font` (sem FOIT).
- **HOME-34 — Degradação com banco indisponível.** Mantida a regra atual: rota 200, sem destaque nem fileiras, mensagem acessível; busca continua renderizada.
- **HOME-35 — Verificação.** Unitários (card, fileiras, modos, clones sem ids duplicados, reduced-motion, faixa estática); Playwright com axe em `/` nos estados de §5 (incl. `reducedMotion: 'reduce'` e projeto **sem JS**); Lighthouse a11y = 1.0 nas rotas de HOME-04; roteiro NVDA + VoiceOver versionado em `docs/` (mesma prática do T8 do REV-19).

## 5. Estados obrigatórios

| Estado | Comportamento esperado |
|---|---|
| Acervo com **0** publicadas | Sem hero-carrossel e sem fileiras; estado "acervo vazio" (LST-04), distinto de "sem resultados". |
| **1–3** destaques (não enchem a viewport) | Faixa estática: sem cópias, sem movimento, sem pausa, sem setas (HOME-15). |
| **N** destaques | Loop contínuo com pausa (HOME-12/13). |
| Resenha **sem `cover_url`** | Fallback escuro com formas abstratas `aria-hidden` (HOME-19). |
| Resenha **sem `excerpt`** | Sinopse só com título/meta/termos; `aria-describedby` só se houver termo (HOME-22). |
| Resenha **sem termo de deficiência** | Fora das fileiras por termo; vai para "Outras resenhas" (HOME-28, C-4). Aparece normalmente no destaque e na busca. |
| **Sem JS** | Lista única rolável, sem setas/pausa, busca GET, fileiras roláveis por teclado (HOME-11, HOME-27). |
| **`prefers-reduced-motion`** | Sem movimento, sem pausa, sem transição da sinopse (HOME-14). |
| **Teclado puro** | Ordem: skip → marca → nav → pausa/setas/"Ver todas" → cards do destaque → busca → fileiras/resultados → paginação → rodapé (LST-21); foco sempre visível e não obscurecido. |
| **Leitor de tela** (NVDA + VoiceOver) | Sem anúncio contínuo; card lido como link + descrição; fileiras nomeadas; cópias invisíveis. Roteiro em HOME-35. |
| **Toque/mobile** | Toque navega; setas ≥ 44 px; rolagem por gesto. |
| **Zoom 200% / reflow 320 px** | HOME-32. |
| **Banco indisponível** | HOME-34. |
| **Busca sem resultados** vs **acervo vazio** | "Nenhuma resenha encontrada" + recuperação (LST-15) vs estado de acervo vazio (LST-04) — mensagens distintas. |

## 6. Impacto nos requisitos LST-*

| LST | Como fica |
|---|---|
| LST-01 (grade SSR em `/`) | **Afetado:** a grade só aparece no modo busca; sem params, fileiras. SSR mantido. |
| LST-02 (conteúdo do card) | **Afetado:** trecho sai da face do card e vai para a sinopse (hover/foco + `aria-describedby`); autor vai para a linha abaixo do card. |
| LST-03 (contagem) | **Afetado:** só no modo busca. |
| LST-05 (campo "Buscar por título") | **Afetado se** C-6 ampliar o alvo da busca. |
| LST-08/09/12 (gênero/autor/ordenar) | **Afetado conforme C-2.** |
| LST-16 (carrossel não gira sozinho) | **Substituído por D-13** (HOME-12..18). |
| LST-17 (slides como links + indicadores) | **Afetado:** links mantidos; indicadores e `role="status"` removidos (HOME-18). |
| LST-18 (destaque derivado) | Mantido; limite de 4 → N (C-3). |
| LST-26 (`ReviewCard` só tokens) | **Afetado:** novo card substitui o atual na home; `ReviewCard` antigo removido se não houver outro consumidor (Design confirma). |
| LST-04, 06, 07, 11, 13–15, 19–25, 27 | Mantidos sem mudança de comportamento. |

## 7. Contraste da paleta nova (WCAG 2.x, luminância relativa)

| Par | Uso | Razão | Mínimo | ✓ |
|---|---|---|---|---|
| ink `#1D1A16` / ground `#F6F1E7` | texto principal | 15.40 | 4.5 | ✓ |
| ink / band `#ECE3D1` | texto sobre faixas | 13.60 | 4.5 | ✓ |
| ink / campo `#FFFDF8` | texto digitado | 17.05 | 4.5 | ✓ |
| secundário `#5A5247` / ground | subtítulos, metas | 6.83 | 4.5 | ✓ |
| secundário / band | metas em faixa | 6.03 | 4.5 | ✓ |
| secundário / campo | dicas em campo | 7.56 | 4.5 | ✓ |
| borda de campo `#6E6557` / campo | contorno do input | 5.64 | 3.0 | ✓ |
| borda de campo / band | contorno do input na faixa | 4.50 | 3.0 | ✓ |
| acento `#0F5E5A` / ground | link | 6.74 | 4.5 | ✓ |
| acento / band | link em faixa | 5.95 | 4.5 | ✓ |
| acento / campo | link em superfície clara | 7.46 | 4.5 | ✓ |
| hover `#0A4441` / ground | link em hover | 9.74 | 4.5 | ✓ |
| hover / band | link em hover na faixa | 8.60 | 4.5 | ✓ |
| branco `#FFFFFF` / acento | texto do botão primário | 7.58 | 4.5 | ✓ |
| branco / hover | botão primário em hover | 10.96 | 4.5 | ✓ |
| ground / card escuro `#2B2620` | texto em card sem capa | 13.32 | 4.5 | ✓ |
| ground / ink | skip link, `.ctl:hover` | 15.40 | 4.5 | ✓ |
| ground / overlay `rgba(29,26,22,.97)` (pior caso: sobre branco) | texto da sinopse | 14.24 | 4.5 | ✓ |
| divisória `#D9CFBC` / overlay (pior caso) | meta da sinopse | 10.38 | 4.5 | ✓ |
| ink / ground | chip do termo na sinopse | 15.40 | 4.5 | ✓ |
| ground / scrim α=.80 (pior caso: imagem branca) | título sobre capa, base | 9.05 | 4.5 | ✓ |
| ground / scrim α=.61 (pior caso) | limite da zona legível (A-6) | 4.50 | 4.5 | ✓ (limite) |
| foco `#0F5E5A` / ground | anel de foco | 6.74 | 3.0 | ✓ |
| foco / band | anel de foco na faixa | 5.95 | 3.0 | ✓ |
| ink / band | borda dos botões `.ctl` | 13.60 | 3.0 | ✓ |
| divisória `#D9CFBC` / ground | fios decorativos | 1.37 | — | decorativo (não identifica controle) |
| foco / card escuro `#2B2620` | — | 1.98 | — | não adjacente: `outline-offset: 3px` deixa o fundo da página entre anel e card |

**Cores mantidas, reconferidas no fundo novo:** red-700 6.93 / green-700 5.79 / amber-700 5.25 / blue-700 7.37 sobre ground; sobre band: 6.12 / 5.11 / **4.64** / 6.51 — todas ≥ 4.5. **`text-muted` atual `#756A5E` reprova sobre band (4.14)** → remapeado (A-4). `text-disabled` `#A89C8C` (2.39) só é aceitável em controle desabilitado (1.4.3 isenta) — Design confirma que não é usado em texto informativo.

## 8. Perguntas abertas (C-n) — decisão do Gabriel

- **C-1 — Copy do `<h1>`.** (a) manter "Observatório Anticapacitista de Literatura e Deficiência" + subtítulo atual (pedido da Mirian no doc de customização); (b) adotar a do protótipo: "Literatura, cinema e deficiência, lidos com olhar crítico" + "Resenhas críticas de obras literárias e audiovisuais…". *Recomendo (a)*: foi pedido explícito da coordenação e é o nome institucional; a copy do protótipo pode virar o subtítulo.
- **C-2 — Filtros `genero`/`autor`/`ordem`.** O protótipo só mostra busca + deficiência. (a) remover do layout (URLs antigas seguem funcionando, param ignorado sem erro); (b) manter visíveis; (c) mantê-los num `<details>` "Mais filtros" (nativo, funciona sem JS). *Recomendo (c)*: layout do protótipo sem perder função.
- **C-3 — Limite de destaques.** *Recomendo 10* (o do protótipo). Com o acervo atual (5 publicadas), a faixa fica estática (HOME-15) até crescer.
- **C-4 — Fileira "Outras resenhas".** *Recomendo sim*, por último e sem "Ver todos"; sem ela, resenha sem termo só é achável pela busca.
- **C-5 — Hero no modo busca.** O protótipo mantém a faixa em movimento acima dos resultados. *Recomendo esconder o carrossel quando há busca ativa*: depois do submit a página recarrega no topo e o resultado fica abaixo de uma faixa animada.
- **C-6 — Rótulo e alvo da busca.** Protótipo: "Buscar por título, autor ou tema"; hoje a busca é só por título (LST-05). (a) manter "Buscar por título"; (b) ampliar para título **ou** autor (`or` no servidor) e rotular "Buscar por título ou autor". *Recomendo (b)*; "tema" fica de fora (não há campo de tema).
- **C-7 — Nome da seção de resenhas.** Protótipo: `h2` "Catálogo"; o nav diz "Resenhas" (pedido da Mirian). *Recomendo "Resenhas"* para nav e seção não divergirem.
- **C-8 — Subtítulo da marca no header.** Protótipo: "OLDA" + "Observatório de Literatura, Deficiência e Arte". Esse nome difere do `<h1>` de C-1(a). Manter o subtítulo (com qual texto?) ou só "OLDA"?
- **C-9 — Kicker do card.** Protótipo: "Livro · 1995" (tipo de obra). Hoje só há livros. *Recomendo "Gênero · Ano"* (omite o que faltar).
- **C-10 — Pausa persiste?** *Recomendo* guardar a pausa em `sessionStorage` (com try/catch) para não recomeçar o movimento a cada volta à home na mesma sessão.
- **C-11 — Escopo de D-13 em WCAG 2.2.** A DoD do projeto é 2.1 AA; este spec usa 2.4.11 e 2.5.8 (2.2). *Recomendo* adotar 2.2 AA como alvo de todo trabalho novo a partir de D-13.
- **C-12 — Itens por fileira.** *Recomendo 12*; "Ver todos" cobre o resto.

## 9. Pontos de auditoria (A-n) — resolver no Design

- **A-1** — Protótipo usa "Catálogo" e "Sugestões" no nav; produção usa "Resenhas" e "Sugestões LIA" (doc da Mirian). O spec segue **produção**.
- **A-2** — Rodapé do protótipo traz nav "Acessibilidade"/"Contato" e texto "OLDA — Observatório de Literatura, Deficiência e Arte · Projeto LIA". Rotas não existem (sem links mortos) e o texto atual foi pedido pela Mirian → rodapé mantém o texto atual; links novos fora de escopo.
- **A-3** — Atkinson Hyperlegible só tem 400/700. `--type-label` usa `--font-weight-medium` (500) → remapear para 700 (rótulos) ou 400; conferir visualmente no admin.
- **A-4** — `text-muted` `#756A5E` dá 4.14 sobre band → remapear para `#5A5247` (6.03).
- **A-5** — O protótipo usa hex fora da lista aprovada: campo `#FFFDF8`, texto de botão `#FFFFFF`, scrim `rgba(20,17,13,…)`, 14 cores de arte do fallback e brancos translúcidos das formas. Todos viram token (`--color-art-1..n` etc.) para cumprir HOME-01. Confirmar se a paleta de arte é a do protótipo.
- **A-6** — Scrim: α cai de .80 (38% da altura) a 0 (72%); α ≥ .61 até ~46% da altura. Legenda (kicker + 3 linhas de título) precisa caber nessa zona nos dois tamanhos (352 e 304 px) — validar com o título mais longo do acervo; se não couber, subir o degradê.
- **A-7** — Protótipo põe `tabIndex=0` e `aria-label` direto no `<ul>` da fileira. Preferir wrapper `role="region"` nomeado (axe `scrollable-region-focusable`) com `<ul>` intacto dentro.
- **A-8** — Títulos de card como heading (h3 no destaque, h4 nas fileiras) geram dezenas de headings; conferir com NVDA se a navegação por H fica útil ou se os cards das fileiras devem ser só links.
- **A-9** — Feedback (red/green/amber/blue) mantido; conferido ≥ 4.5 no fundo novo (§7). `amber-700` sobre band fica em 4.64 — sem folga.
- **A-10** — `--focus-shadow` usa `--focus-ring-offset = surface-page`; dentro da faixa `band` o anel interno precisa usar a cor da faixa (override por contexto).
- **A-11** — Testes de LST-16/17 (`FeaturedCarousel*`) serão reescritos/removidos; Design lista quais.
- **A-12** — Query das fileiras: uma consulta por termo vs. uma consulta única agrupada no servidor. Acervo pequeno hoje; Design decide mantendo `status='published'` explícito e sem `service_role`.
- **A-13** — Mesma resenha em destaque e em várias fileiras → links repetidos na lista de links do leitor de tela. Aceitável; ids por instância obrigatórios (HOME-22).
- **A-14** — O protótipo filtra no cliente e por nome de deficiência; proibido aqui (HOME-31) — a referência é só visual.
- **A-15** — Fonte do corpo das resenhas (texto longo) passa de serifa (Newsreader) para Atkinson. Decisão já tomada; registrar no D-13 e checar medida de linha/entrelinha na página da resenha.

## 10. Rastreabilidade

| ID | Requisito | WCAG | Fase | Status |
|---|---|---|---|---|
| HOME-01 | Tokens: paleta nova, aliases remapeados, zero hex fora do `@theme` | 1.4.3, 1.4.11 | Specify | Pending |
| HOME-02 | Fontes Fraunces + Atkinson via next/font | — | Specify | Pending |
| HOME-03 | Contraste calculado dos tokens | 1.4.3, 1.4.11 | Specify | Pending |
| HOME-04 | Rotas existentes: axe 0, Lighthouse a11y 1.0 | — | Specify | Pending |
| HOME-05 | Foco 3px + offset 3px, ≥3:1 | 2.4.7, 1.4.11 | Specify | Pending |
| HOME-06 | Alvos ≥ 44 px | 2.5.8, 2.5.5 | Specify | Pending |
| HOME-07 | Header: marca à esquerda, SiteNav à direita | 1.3.1, 2.4.8 | Specify | Pending |
| HOME-08 | Um h1, landmarks, hierarquia | 1.3.1, 2.4.1, 2.4.6 | Specify | Pending |
| HOME-09 | Hero h1 + subtítulo | 2.4.6 | Specify | Pending |
| HOME-10 | Destaques: N mais recentes | — | Specify | Pending |
| HOME-11 | Carrossel sem JS: lista única, sem controles mortos | 2.1.1 | Specify | Pending |
| HOME-12 | Movimento por scrollLeft+rAF, cópias client-only inertes | 2.2.2, 4.1.2 | Specify | Pending |
| HOME-13 | Pausar/Retomar + pausas automáticas | 2.2.2, 2.5.3 | Specify | Pending |
| HOME-14 | reduced-motion | 2.3.3 | Specify | Pending |
| HOME-15 | Faixa estática quando não enche | 2.2.2 | Specify | Pending |
| HOME-16 | Setas anterior/próximo | 2.1.1, 4.1.2 | Specify | Pending |
| HOME-17 | Foco não obscurecido | 2.4.11 | Specify | Pending |
| HOME-18 | Sem role=status contínuo nem dots | 4.1.3 | Specify | Pending |
| HOME-19 | Anatomia do card | 1.1.1 | Specify | Pending |
| HOME-20 | Título legível sobre qualquer imagem | 1.4.3 | Specify | Pending |
| HOME-21 | Sinopse hover/foco dispensável, hoverable, persistente | 1.4.13 | Specify | Pending |
| HOME-22 | aria-describedby por instância | 1.3.1, 4.1.2 | Specify | Pending |
| HOME-23 | Card inteiro clicável, 1 parada de Tab | 2.4.3, 2.5.8 | Specify | Pending |
| HOME-24 | Toque navega | 2.5.1 | Specify | Pending |
| HOME-25 | Fileira por termo ativo com publicadas | — | Specify | Pending |
| HOME-26 | "Ver todos" com nome distinto | 2.4.4, 2.5.3 | Specify | Pending |
| HOME-27 | Fileira rolável por teclado sem JS | 2.1.1 | Specify | Pending |
| HOME-28 | "Outras resenhas" | — | Specify | Pending (C-4) |
| HOME-29 | Form GET, sem JS | 2.1.1, 3.3.2 | Specify | Pending |
| HOME-30 | Dois modos: fileiras / grade | 4.1.3 | Specify | Pending |
| HOME-31 | Nada filtrado no cliente | — | Specify | Pending |
| HOME-32 | Reflow 320 px, zoom 200% | 1.4.10, 1.4.4 | Specify | Pending |
| HOME-33 | Movimento parado fora de vista, sem CLS | 2.2.2 | Specify | Pending |
| HOME-34 | Banco indisponível sem 500 | — | Specify | Pending |
| HOME-35 | Testes + roteiro NVDA/VoiceOver | — | Specify | Pending |
