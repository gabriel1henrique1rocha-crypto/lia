import type { Metadata } from 'next'
import { SectionPlaceholder } from '@/components/nav/SectionPlaceholder'

// Metadata própria da rota. SEM `robots: noindex`: a seção existe de fato e a
// página diz a verdade sobre seu estado — não há por que escondê-la do índice.
// Também NÃO entra em sitemap enquanto estiver vazia (o projeto ainda não tem
// `app/sitemap.ts`; ao criar um, excluir estas rotas até ganharem conteúdo).
export const metadata: Metadata = {
  title: 'LIACast · LIA',
  description: 'O podcast do LIA — em construção, será publicado em breve.',
}

export default function LIACastPage() {
  return <SectionPlaceholder title="LIACast" />
}
