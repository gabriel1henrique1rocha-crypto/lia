import type { Metadata } from 'next'
import { getAuthenticatedEditor } from '@/lib/auth/requireEditor'

export const metadata: Metadata = {
  title: 'Painel — LIA',
  robots: { index: false, follow: false },
}

// Stub mínimo pós-login (fundação — C-5/escopo: SEM painel de CRUD ainda). Prova
// que o gate resolveu a sessão e o papel. O acessor estreitado reusa o resultado
// já resolvido no layout (cache() por request) e devolve o editor SEM união nem
// null — o layout garante 'ok'; se a garantia mudar, isto falha barulhento.
export default async function AdminHome() {
  const { role } = await getAuthenticatedEditor()

  return (
    <section className="lia-login" aria-labelledby="admin-heading">
      <h1 id="admin-heading" className="lia-login__heading">
        Painel
      </h1>
      <p className="lia-login__intro">
        Você está autenticado como <strong>{role}</strong>.
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="lia-btn lia-btn--secondary lia-btn--md">
          Sair
        </button>
      </form>
    </section>
  )
}
