import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'
import { LoginError } from './LoginError'

export const metadata: Metadata = {
  title: 'Entrar — LIA',
  // Fluxo interno: fora de índices de busca.
  robots: { index: false, follow: false },
}

// Mensagens de erro do callback (?erro=). Renderizadas no SERVIDOR — chegam
// prontas no HTML e o leitor de tela as lê no load (a LoginError move o foco).
const ERROR_MESSAGES: Record<string, string> = {
  'link-invalido': 'O link de acesso é inválido ou expirou. Solicite um novo abaixo.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const errorMessage = erro
    ? (ERROR_MESSAGES[erro] ?? 'Não foi possível entrar. Tente novamente.')
    : null

  return (
    <section className="lia-login" aria-labelledby="login-heading">
      <h1 id="login-heading" className="lia-login__heading">
        Entrar no painel
      </h1>
      <p className="lia-login__intro">
        Informe seu e-mail para receber um link de acesso. Sem senha.
      </p>
      {errorMessage && <LoginError message={errorMessage} />}
      <LoginForm />
    </section>
  )
}
