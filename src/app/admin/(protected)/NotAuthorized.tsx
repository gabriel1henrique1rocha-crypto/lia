// Tela de acesso NÃO AUTORIZADO (SEC-07): sessão válida, mas sem linha editor
// ativa. Não expõe nenhum dado sensível; oferece apenas o Sair (POST server-side).
// Server component puro — o signout não precisa de JS.
export function NotAuthorized() {
  return (
    <section className="lia-login" aria-labelledby="na-heading">
      <h1 id="na-heading" className="lia-login__heading">
        Acesso não autorizado
      </h1>
      <p className="lia-login__intro">
        Sua conta não tem permissão para acessar o painel. Se você acredita que isso é um engano,
        fale com um administrador.
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="lia-btn lia-btn--secondary lia-btn--md">
          Sair
        </button>
      </form>
    </section>
  )
}
