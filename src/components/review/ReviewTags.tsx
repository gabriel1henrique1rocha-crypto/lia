/**
 * Tags da resenha (`review.tags`, REV-08 / design §7).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXIBIR É EXIBIR — nada aqui sugere navegação
 *
 * A filtragem por tag está adiada por completo (TAGS=c), e a taxonomia de
 * deficiência representada virá como ENTIDADE PRÓPRIA, com filtro (D-12). Então
 * as tags de hoje são texto livre, e a marcação tem de dizer exatamente isso:
 *
 *   · **sem `<a>`** — link que não leva a lugar nenhum é promessa quebrada, e um
 *     leitor de tela que lista os links da página anunciaria destinos
 *     inexistentes;
 *   · **sem `role="button"`, sem cursor de mão, sem estilo de link** — a
 *     aparência não pode insinuar interação que não existe;
 *   · **sem página de termo**, sem `?tag=` na URL.
 *
 * Quando a D-12 chegar, o que muda aqui é a marcação virar `<a>` — e será uma
 * mudança deliberada, não o descobrimento de que a UI já prometia isso.
 *
 * `<ul>`/`<li>` e não `<span>` soltos: é uma lista, e o leitor de tela anuncia
 * "lista de 3 itens" — quem navega sem ver sabe quantas tags existem e quando
 * elas acabam. Com spans, viraria um borrão de palavras coladas ao texto vizinho.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lista vazia (o DEFAULT da coluna, e o caso das 5 resenhas em produção) → NÃO
 * RENDERIZA NADA: sem título "Tags" órfão sobre lista vazia.
 */
export function ReviewTags({
  tags,
  headingId = 'resenha-tags',
}: {
  tags: string[] | null | undefined
  /** Id do heading que nomeia a seção. Explícito para a página poder garantir
   *  unicidade caso o componente apareça mais de uma vez no documento. */
  headingId?: string
}) {
  const lista = (tags ?? []).map((tag) => tag.trim()).filter(Boolean)
  if (lista.length === 0) return null

  return (
    <section className="lia-review-tags" aria-labelledby={headingId}>
      <h2 id={headingId} className="lia-review-tags__title">
        Tags
      </h2>
      <ul className="lia-review-tags__list">
        {lista.map((tag) => (
          <li key={tag} className="lia-review-tags__item">
            {tag}
          </li>
        ))}
      </ul>
    </section>
  )
}
