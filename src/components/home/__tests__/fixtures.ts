import type { ReviewListItem } from '@/lib/review/queries'

/** Resenha de listagem mínima e válida; `over` sobrescreve o que o teste quer ver. */
export function resenha(i: number, over: Partial<ReviewListItem> = {}): ReviewListItem {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Resenha ${i}`,
    slug: `resenha-${i}`,
    published_at: '2026-09-01T00:00:00Z',
    excerpt: `Trecho da resenha ${i}.`,
    book: {
      title: `Livro ${i}`,
      author: `Autora ${i}`,
      genre: { name: 'Romance', slug: 'romance' },
      year: 1990 + i,
      cover_url: null,
    },
    disabilities: [{ name: 'Deficiência visual', slug: 'deficiencia-visual' }],
    ...over,
  }
}
