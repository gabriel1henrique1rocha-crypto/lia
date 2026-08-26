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

/** Opção de gênero para o `select` do formulário de resenha (T8/T10). */
export type GenreOption = { id: string; name: string }

/**
 * Lista os gêneros para o `select` da ficha (`book.genre_id` é NOT NULL).
 *
 * CLIENT PÚBLICO, e não o autenticado, embora o consumidor seja uma rota do
 * painel: `genre` é dado de REFERÊNCIA público — GRANT a `anon`+`authenticated`
 * (0004) e policy `genre_public_read ... using (true)` (0006). Ler pelo caminho
 * anon deixa explícito que a lista não é escopada por editor e não depende da
 * sessão; é a mesma escolha das outras leituras deste arquivo.
 *
 * Ordenado por nome (pt-BR no banco) para o `select` ter ordem estável — uma
 * lista de opções que muda de ordem entre visitas é hostil a quem escolhe por
 * posição.
 */
export async function listGenres(): Promise<GenreOption[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('genre').select('id, name').order('name')
  if (error) throw error
  return data ?? []
}
