# review-page — Contexto (decisões do Specify)

> Decisões de gray areas capturadas na fase Specify (processo *discuss*).
> Alimentam a fase Design. Documentação em português; identificadores em inglês.

## C-1 — Exibição da nota: **só número** (sem estrelas)

**Pergunta:** como apresentar `review.rating` (numeric 0–5, só EXIBIÇÃO) sem
componente de estrelas no styleguide do M0 e com a escala/UX de entrada deferida
para `reviews-crud`/D-01.

**Decisão:** exibir **apenas o valor numérico textual** (ex.: `4,5 / 5`), sem
componente visual de estrelas nem medidor. Sem antecipar a UX de estrelas/meia-
estrela proposta em D-01 — isso é decidido no M2.

**Por quê:** mais simples; não fixa decisão de UX de entrada antes de D-01;
evita criar um componente visual (estrelas) fora do conjunto de tokens/componentes
do M0; mantém o foco da feature na leitura.

**Como aplica no Design:** um helper/compoonente mínimo de formatação numérica
(localizada pt-BR, vírgula decimal) com texto acessível. Nota é **nullable** no
schema → quando ausente, **omitir** o bloco (sem "sem nota"). A representação
visual de estrelas/meia-estrela fica para `reviews-crud`/D-01 (M2).

## C-2 — Placeholders M3: **âncora semântica + aviso "em breve"**

**Pergunta:** os placeholders ESTRUTURAIS (sem lógica) de comentários e do botão
recomendar — funcionalidade só no M3 (`public-comments`, `recommendations`) —
devem sinalizar algo ao usuário ou ser âncoras invisíveis?

**Decisão:** renderizar a **estrutura semântica com sinalização ao usuário**:
- Seção `<section>` de comentários com heading (ex.: "Comentários") e um texto
  acessível indicando que a funcionalidade chega em breve.
- Botão "Recomendar" **presente porém desabilitado** (estado comunicado de forma
  acessível — não só visual: `disabled` + texto/`aria` deixando claro que ainda
  não está ativo).

**Por quê:** o usuário entende que os recursos existem e virão; cria as âncoras
(landmarks/headings/ids) que o M3 vai plugar; mantém a página coerente e testável
de a11y agora.

**Como aplica no Design:** **zero lógica de negócio** (sem fetch de comentários,
sem POST de voto, sem contagem real). Apenas markup semântico + cópia "em breve".
O botão desabilitado não dispara ação. Garantir que o estado desabilitado e o
aviso "em breve" sejam acessíveis (texto, não só cor/estilo) para WCAG 2.1 AA.
