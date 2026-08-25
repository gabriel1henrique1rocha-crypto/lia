/**
 * Normalização de título → slug (REV-23). Função PURA e determinística: mesma
 * entrada, mesma saída, sempre. Sem I/O, sem estado, sem relógio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FRONTEIRA COM `unique_review_slug` (migration 0011) — LEIA ANTES DE ESTENDER.
 *
 * Esta função **NÃO resolve unicidade**, e não deve passar a resolver. A divisão
 * é deliberada e tem uma razão de correção, não de gosto:
 *
 *   · aqui (app)  → NORMALIZA: acentos, caixa, separadores, comprimento.
 *   · lá (banco)  → RESOLVE COLISÃO: sufixo `-2`, `-3`… sob advisory lock, com
 *                   o índice UNIQUE `review_slug_key` como backstop.
 *
 * Só o banco pode decidir unicidade, porque só ele enxerga TODOS os slugs —
 * inclusive rascunhos de outros editores, que a RLS esconde do chamador. Se esta
 * função tentasse verificar colisão, precisaria consultar o banco sob RLS,
 * enxergaria menos do que existe, e devolveria um slug "livre" que o INSERT
 * rejeitaria. Pior: passariam a existir DUAS fontes de verdade para o mesmo
 * invariante, divergindo em silêncio.
 *
 * Consequência prática: o retorno daqui é a **base** do slug (`p_slug_base` do
 * RPC), não o slug final. Quem grava é o banco.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Teto de comprimento da base do slug.
 *
 * O banco NÃO limita (`review.slug` é `text` sem CHECK), então isto é decisão de
 * aplicação, não espelhamento de constraint. Motivos: um slug vem de título
 * livre e vai para dentro de uma URL — sem teto, um título de 400 caracteres
 * produz uma URL hostil de copiar, compartilhar e ler em leitor de tela. O corte
 * também deixa folga para o sufixo de desambiguação que o banco acrescenta
 * (`-2`, `-3`, …), que de outro modo alongaria ainda mais o caso já extremo.
 *
 * Colisão criada pelo corte (dois títulos longos com o mesmo prefixo) é problema
 * RESOLVIDO: cai no `unique_review_slug`, que é justamente quem trata colisão.
 */
export const MAX_SLUG_BASE_LENGTH = 80

/**
 * Converte um título em base de slug.
 *
 * Regras: minúsculas; acentuação do português reduzida ao ASCII equivalente
 * (`ç`→`c`, `ã`→`a`, `é`→`e`), preservando a legibilidade da palavra em vez de
 * descartá-la; qualquer sequência de caracteres não alfanuméricos vira um único
 * hífen; sem hífen nas pontas; truncado em `MAX_SLUG_BASE_LENGTH` sem deixar
 * hífen solto na borda.
 *
 * CASOS DE BORDA — todos devolvem **string vazia**, de propósito:
 * título vazio, só espaços, ou composto apenas de símbolos (`'!!! ??? ---'`),
 * que normaliza para nada.
 *
 * Por que `''` e não um fallback como `'resenha'`: o fallback JÁ EXISTE no
 * `unique_review_slug` (`if v_base is null then v_base := 'resenha'`). Repetir a
 * constante aqui criaria dois lugares para mudá-la e a chance de divergirem —
 * o mesmo erro que a fronteira acima existe para evitar. Devolver `''` é dizer
 * "não há base derivável deste título", e deixar quem grava decidir o fallback.
 * Quem chamar esta função direto e precisar de um valor não-vazio deve tratar
 * o `''` explicitamente.
 */
export function slugify(title: string): string {
  const semAcento = title
    .normalize('NFD') // separa a letra do diacrítico…
    .replace(/[\u0300-\u036f]/g, '') // …e descarta o diacrítico (bloco combinante)

  const base = semAcento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // qualquer não-alfanumérico vira separador
    .replace(/^-+|-+$/g, '') // sem hífen nas pontas

  if (base.length <= MAX_SLUG_BASE_LENGTH) return base

  // Trunca e remove o hífen que o corte possa ter deixado na borda — `dom-` é
  // um slug feio e `dom--2` (com o sufixo do banco) seria pior.
  return base.slice(0, MAX_SLUG_BASE_LENGTH).replace(/-+$/, '')
}
