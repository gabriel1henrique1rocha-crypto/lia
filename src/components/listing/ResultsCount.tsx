/**
 * Anúncio da contagem de resultados (LST-23 / DD-9). Fica num `<p role="status">`
 * (aria-live=polite implícito), primeiro conteúdo da região de resultados.
 *
 * Mecânica (DD-9): numa navegação SSR completa esta live region NÃO dispara
 * sozinha (só anuncia mutações após a carga) — o anúncio de "X resultados" vem
 * do `<title>` do documento + ordem de leitura. O `role="status"` dispara por si
 * só quando o resultado troca por mutação de DOM sem recarga (enhancement JS
 * futuro) e no estado vazio; em nenhum caminho rouba foco. Número em pt-BR.
 */
export function ResultsCount({ total }: { total: number }) {
  const formatted = new Intl.NumberFormat('pt-BR').format(total)
  return (
    <p className="lia-results__count" role="status">
      Resenhas · {formatted}
    </p>
  )
}
