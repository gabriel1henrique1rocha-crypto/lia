import { createPublicClient } from '@/lib/supabase/public'
import type { Tables } from '@/lib/database.types'

/**
 * Leitura tipada da ficha do livro com o gênero embutido (join).
 * Consumida pela exibição (BookDetails) e pela página de resenha (M1).
 * A cobertura de contrato (RLS, dados reais) está no teste de integração T-22.
 */
export type BookView = Tables<'book'> & {
  genre: { name: string; slug: string } | null
}

const BOOK_SELECT = '*, genre(name, slug)'

/** Retorna a ficha pelo id, ou `null` quando não encontrada (sem lançar). */
export async function getBookById(id: string): Promise<BookView | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('book').select(BOOK_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as BookView | null) ?? null
}

/** Lista todas as fichas (ordenadas por título), com o gênero embutido. */
export async function listBooks(): Promise<BookView[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('book').select(BOOK_SELECT).order('title')
  if (error) throw error
  return (data as BookView[] | null) ?? []
}
