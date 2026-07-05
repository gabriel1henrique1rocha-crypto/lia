import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'
import type { BookView } from '@/lib/book/queries'

/**
 * Leitura tipada de uma resenha publicada, com a ficha do livro (book + genre)
 * embutida no mesmo select. Consumida pela rota `/resenha/[slug]` (page + metadata).
 * A cobertura de contrato (RLS, dados reais) está no teste de integração T-31.
 */
export type ReviewView = Tables<'review'> & {
  book: BookView
}

const REVIEW_SELECT = '*, book(*, genre(name, slug))'

/**
 * Busca a resenha publicada pelo `slug`, ou `null` quando inexistente OU em
 * rascunho (sem lançar). O filtro `status='published'` é EXPLÍCITO na query —
 * não delegado ao RLS — porque o server client pode usar service_role (que
 * ignora RLS); assim RVW-03/RVW-13 valem mesmo nesse caminho.
 *
 * Envolvida em `cache()` do React: `generateMetadata` e a `page` chamam esta
 * função na mesma requisição; o cache deduplica para uma única viagem ao banco.
 */
export const getPublishedReviewBySlug = cache(
  async (slug: string): Promise<ReviewView | null> => {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('review')
      .select(REVIEW_SELECT)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw error
    return (data as ReviewView | null) ?? null
  },
)
