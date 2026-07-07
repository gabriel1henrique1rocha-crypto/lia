import Link from 'next/link'
import type { ListingParams } from '@/lib/review/listingParams'

export type EmptyStateProps =
  | { variant: 'empty-catalog' }
  | { variant: 'no-results'; params: ListingParams }

/**
 * Estado vazio acessível (LST-04/15). Duas variantes DISTINTAS:
 * - `no-results`: busca/filtros não retornaram nada → `role="status"`, ecoa o
 *   termo/filtros ativos (texto, não só ícone) e oferece recuperação por LINKS
 *   (funcionam sem JS): "Ver todas as resenhas" e "Limpar filtros" (ambos → `/`).
 * - `empty-catalog`: não há nenhuma resenha publicada → mensagem informativa,
 *   SEM ações de recuperação (não é um filtro estreito).
 * O título é um `<p>` estilizado (não heading) para não competir com o `<h2>` da
 * seção de resultados; o anúncio ao leitor de tela vem do `role="status"`.
 */
export function EmptyState(props: EmptyStateProps) {
  if (props.variant === 'empty-catalog') {
    return (
      <div className="lia-empty" role="status">
        <p className="lia-empty__title">Ainda não há resenhas publicadas</p>
        <p className="lia-empty__text">
          Assim que as primeiras resenhas forem publicadas, elas aparecem aqui.
        </p>
      </div>
    )
  }

  const { params } = props
  const bits: string[] = []
  if (params.q) bits.push(`título contendo “${params.q}”`)
  if (params.genero) bits.push(`gênero “${params.genero}”`)
  if (params.autor) bits.push(`autor “${params.autor}”`)
  if (params.nota != null) bits.push(`nota mínima ${params.nota}`)
  const echo = bits.length > 0 ? ` para ${bits.join(', ')}` : ''

  return (
    <div className="lia-empty" role="status">
      <p className="lia-empty__title">Nenhuma resenha encontrada</p>
      <p className="lia-empty__text">
        Não encontramos resenhas{echo}. Tente ajustar a busca ou os filtros.
      </p>
      <div className="lia-empty__actions">
        <Link className="lia-btn lia-btn--primary lia-btn--md" href="/">
          Ver todas as resenhas
        </Link>
        <Link className="lia-link" href="/">
          Limpar filtros
        </Link>
      </div>
    </div>
  )
}
