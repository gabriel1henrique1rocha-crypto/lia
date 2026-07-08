import type { Metadata } from 'next'
import { requireEditor } from '@/lib/auth/requireEditor'

export const metadata: Metadata = {
  title: 'Painel — LIA',
  robots: { index: false, follow: false },
}

// Stub mínimo pós-login (fundação — C-5/escopo: SEM painel de CRUD ainda). Prova
// que o gate resolveu a sessão e o papel. requireEditor() aqui reusa o resultado
// já resolvido no layout (cache() por request). O layout garante status 'ok'.
export default async function AdminHome() {
  const session = await requireEditor()
  const role = session.status === 'ok' ? session.editor.role : null

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
