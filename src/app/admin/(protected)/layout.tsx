import { redirect } from 'next/navigation'
import { requireEditor } from '@/lib/auth/requireEditor'
import { NotAuthorized } from './NotAuthorized'

// Gate AUTORITATIVO do painel (SEC-08). Aplica-se a TUDO no route group
// (protected) — /admin/login fica FORA do grupo, público. O proxy (T7) é só
// otimista; a decisão real de papel é aqui + na RLS (defesa em profundidade).
//
// Route group (protected): não adiciona segmento de URL → este layout protege
// /admin (a home stub) e futuras rotas do painel, sem alterar os caminhos.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireEditor()

  // Sem sessão → login. (O proxy já tende a redirecionar antes; aqui é a garantia
  // autoritativa, imune a bypass da camada de proxy — CVE-2025-29927.)
  if (session.status === 'unauthenticated') redirect('/admin/login')

  // Sessão válida, mas sem editor ativo → barrado (SEC-07), sem tocar o painel.
  if (session.status === 'forbidden') return <NotAuthorized />

  return <>{children}</>
}
