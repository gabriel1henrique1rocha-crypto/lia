import { formatRating } from '@/lib/review/formatRating'

/**
 * Exibe a nota da resenha como valor numérico localizado (C-1: só número, sem
 * estrelas/medidor). A representação visual e a alternativa textual acessível
 * são nós distintos: o texto visível é `aria-hidden` (evita leitura dupla) e o
 * `.sr-only` anuncia a nota por extenso ao leitor de tela.
 *
 * O componente assume `rating` presente — a OMISSÃO quando nulo (RVW-09) é
 * responsabilidade do chamador (a página).
 */
export function Rating({ rating }: { rating: number }) {
  const value = formatRating(rating)
  return (
    <p className="lia-rating">
      <span aria-hidden="true">{value} / 5</span>
      <span className="sr-only">Nota: {value} de 5</span>
    </p>
  )
}
