import Link from 'next/link'
import type { ListingParams, SortOrder } from '@/lib/review/listingParams'
import type { FilterOptions } from '@/lib/review/queries'

const SORT_LABELS: Record<SortOrder, string> = {
  recentes: 'Mais recentes',
  titulo: 'Título (A–Z)',
}

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
 * SEM JS (LST-05/07/11/12/25, HOME-29/31). Controles nativos rotulados por
 * `<label htmlFor>`; `pagina` não é campo do form → nova busca volta à página 1.
 *
 * home-redesign:
 *  · C-6 — a busca casa título OU autor; o rótulo diz isso.
 *  · C-2 — gênero/autor/ordem ficam num `<details>` "Mais filtros": nativo,
 *    abre por teclado e sem JS, e os campos dentro dele são enviados mesmo
 *    fechado. Abre sozinho quando algum desses filtros está ativo — senão o
 *    filtro aplicado ficaria escondido.
 *  · "Limpar" é LINK para `/` (funciona sem JS; botão `type=reset` só voltaria
 *    ao estado da URL atual).
 */
export function ListingControls({
  params,
  options,
}: {
  params: ListingParams
  options: FilterOptions
}) {
  const maisFiltrosAtivos = Boolean(params.genero || params.autor || params.ordem !== 'recentes')

  return (
    <form
      method="GET"
      action="/"
      role="search"
      aria-label="Buscar resenhas"
      className="lia-listing-controls"
    >
      <div className="lia-listing-controls__main">
        <div className="lia-field lia-listing-controls__q">
          <label className="lia-field__label" htmlFor="q">
            Buscar por título ou autor
          </label>
          <input
            className="lia-field__control"
            type="search"
            id="q"
            name="q"
            defaultValue={params.q}
            maxLength={100}
            autoComplete="off"
          />
        </div>

        {/* Deficiência representada (D-12) — o eixo editorial do observatório.
            Só aparece quando há ao menos um termo com resenha publicada: um
            select só com "Todas" seria um controle que não controla nada. */}
        {options.disabilities.length > 0 && (
          <div className="lia-field lia-listing-controls__dis">
            <label className="lia-field__label" htmlFor="deficiencia">
              Deficiência representada
            </label>
            <span className="lia-field__select-wrap">
              <select
                className="lia-field__control"
                id="deficiencia"
                name="deficiencia"
                defaultValue={params.deficiencia}
              >
                <option value="">Todas as deficiências</option>
                {options.disabilities.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Chevron />
            </span>
          </div>
        )}

        <div className="lia-listing-controls__actions">
          <button type="submit" className="lia-btn lia-btn--primary lia-btn--lg">
            Buscar
          </button>
          <Link className="lia-btn lia-btn--secondary lia-btn--lg" href="/">
            Limpar
          </Link>
        </div>
      </div>

      <details className="lia-listing-controls__more" open={maisFiltrosAtivos}>
        <summary className="lia-listing-controls__summary">Mais filtros</summary>
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
      </details>
    </form>
  )
}
