import { buildListingHref, PAGE_SIZE, type ListingParams } from '@/lib/review/listingParams'

/** Janela de páginas: sempre 1 e última, mais current±1, com reticências. */
function pageItems(current: number, totalPages: number): (number | 'ellipsis')[] {
  const pages = new Set<number>([1, totalPages])
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const items: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('ellipsis')
    items.push(p)
    prev = p
  }
  return items
}

/**
 * Paginador acessível (LST-13/22): `<nav aria-label>` com ‹ › + números e
 * reticências. Links preservam `q/genero/autor/nota/ordem` (buildListingHref);
 * a página atual tem `aria-current="page"` E distinção não-cromática (CSS).
 * ‹ › nas bordas ficam desabilitados (não viram link morto). Não renderiza nada
 * quando há uma página só.
 */
export function Pagination({ params, total }: { params: ListingParams; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (totalPages <= 1) return null
  const current = Math.min(Math.max(params.pagina, 1), totalPages)
  const items = pageItems(current, totalPages)

  return (
    <nav className="lia-pagination" aria-label="Paginação">
      {current > 1 ? (
        <a
          className="lia-pagination__link lia-pagination__nav"
          href={buildListingHref(params, { pagina: current - 1 })}
          rel="prev"
          aria-label="Página anterior"
        >
          ‹
        </a>
      ) : (
        <span
          className="lia-pagination__link lia-pagination__nav"
          aria-disabled="true"
          aria-hidden="true"
        >
          ‹
        </span>
      )}

      <ol className="lia-pagination__list">
        {items.map((item, i) =>
          item === 'ellipsis' ? (
            <li key={`ellipsis-${i}`}>
              <span className="lia-pagination__ellipsis" aria-hidden="true">
                …
              </span>
            </li>
          ) : (
            <li key={item}>
              <a
                className="lia-pagination__link"
                href={buildListingHref(params, { pagina: item })}
                aria-label={`Página ${item}`}
                aria-current={item === current ? 'page' : undefined}
              >
                {item}
              </a>
            </li>
          )
        )}
      </ol>

      {current < totalPages ? (
        <a
          className="lia-pagination__link lia-pagination__nav"
          href={buildListingHref(params, { pagina: current + 1 })}
          rel="next"
          aria-label="Próxima página"
        >
          ›
        </a>
      ) : (
        <span
          className="lia-pagination__link lia-pagination__nav"
          aria-disabled="true"
          aria-hidden="true"
        >
          ›
        </span>
      )}
    </nav>
  )
}
