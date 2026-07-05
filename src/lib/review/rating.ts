/**
 * Formata a nota da resenha como valor numérico localizado em pt-BR
 * (vírgula decimal, sempre 1 casa). Só EXIBIÇÃO — sem estrelas nem medidor (C-1).
 * Ex.: 4.5 → "4,5"; 4 → "4,0".
 *
 * Util puro e testável isolado; a escala/UX de ENTRADA da nota fica para o M2
 * (reviews-crud, D-01). Reutilizável por review-listing-search.
 */
const ratingFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatRating(rating: number): string {
  return ratingFormatter.format(rating)
}
