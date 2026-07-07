import type { ListingParams, SortOrder } from '@/lib/review/listingParams'

type FilterOptions = {
  genres: { name: string; slug: string }[]
  authors: string[]
}

const SORT_LABELS: Record<SortOrder, string> = {
  recentes: 'Mais recentes',
  nota: 'Melhor nota',
  titulo: 'Título (A–Z)',
}

const MIN_RATINGS = [5, 4, 3, 2, 1] as const

/** Chevron decorativo do select (aria-hidden) — evita depender do Field client. */
function Chevron() {
  return (
    <svg
      className="lia-field__chev"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Busca + filtros + ordenação como um único `<form method="GET" action="/">`
 * (Server Component puro, sem estado) — todo o estado vai para a URL e funciona
 * SEM JS (LST-05/07/11/12/25). Controles nativos rotulados programaticamente
 * (`<label htmlFor>`), foco visível herdado do anel global (LST-22). Recebe as
 * opções derivadas do acervo publicado (DD-4) e os `params` atuais (pré-seleção).
 * `pagina` não é campo do form → nova busca/filtro volta à página 1.
 */
export function ListingControls({
  params,
  options,
}: {
  params: ListingParams
  options: FilterOptions
}) {
  return (
    <form
      method="GET"
      action="/"
      role="search"
      aria-label="Buscar e filtrar resenhas"
      className="lia-listing-controls"
    >
      <div className="lia-listing-controls__search">
        <div className="lia-field">
          <label className="lia-field__label" htmlFor="q">
            Buscar por título
          </label>
          <input
            className="lia-field__control"
            type="search"
            id="q"
            name="q"
            defaultValue={params.q}
            placeholder="Buscar por título…"
            maxLength={100}
          />
        </div>
        <button type="submit" className="lia-btn lia-btn--primary lia-btn--md">
          Buscar
        </button>
      </div>

      <div className="lia-listing-controls__filters">
        <div className="lia-field">
          <label className="lia-field__label" htmlFor="genero">
            Gênero
          </label>
          <span className="lia-field__select-wrap">
            <select
              className="lia-field__control"
              id="genero"
              name="genero"
              defaultValue={params.genero}
            >
              <option value="">Todos os gêneros</option>
              {options.genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>

        <div className="lia-field">
          <label className="lia-field__label" htmlFor="autor">
            Autor
          </label>
          <span className="lia-field__select-wrap">
            <select
              className="lia-field__control"
              id="autor"
              name="autor"
              defaultValue={params.autor}
            >
              <option value="">Todos os autores</option>
              {options.authors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>

        <div className="lia-field">
          <label className="lia-field__label" htmlFor="nota">
            Nota mínima
          </label>
          <span className="lia-field__select-wrap">
            <select
              className="lia-field__control"
              id="nota"
              name="nota"
              defaultValue={params.nota != null ? String(params.nota) : ''}
            >
              <option value="">Qualquer nota</option>
              {MIN_RATINGS.map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>

        <div className="lia-field">
          <label className="lia-field__label" htmlFor="ordem">
            Ordenar por
          </label>
          <span className="lia-field__select-wrap">
            <select
              className="lia-field__control"
              id="ordem"
              name="ordem"
              defaultValue={params.ordem}
            >
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
            <Chevron />
          </span>
        </div>
      </div>
    </form>
  )
}
