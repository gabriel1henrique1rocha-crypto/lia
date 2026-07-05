/**
 * Capa TIPOGRÁFICA de fallback: renderiza o título do livro sobre o fundo de
 * marca quando não há imagem de capa (estado de todo o seed do M1). Segue a
 * linguagem do styleguide (`lia-card__media` + modifier `--type`).
 *
 * Contrato mínimo à prova de escopo: recebe SÓ `title`. Esta feature NÃO
 * processa `cover_url` — o pipeline de imagem real é de `storage-covers` (RVW-12).
 *
 * Acessibilidade (RVW-11): `role="img"` + `aria-label="Capa de <título>"` dá a
 * alternativa textual; o título também é texto visível (não texto-como-imagem).
 */
export function BookCover({ title }: { title: string }) {
  return (
    <span
      className="lia-card__media lia-card__media--type"
      role="img"
      aria-label={`Capa de ${title}`}
    >
      {title}
    </span>
  )
}
