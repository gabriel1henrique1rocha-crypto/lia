/**
 * Rodapé mínimo do site (DD-10/LST-21) — landmark `contentinfo`. Fecha a ordem
 * de leitura da Tela 1. Sem links mortos: nav completa (Gêneros/Sobre) só chega
 * com as rotas (C-2). Só tokens (classe `lia-site-footer`).
 */
export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="lia-site-footer">
      <p>LIA — Leituras e impressões anotadas · © {year}</p>
    </footer>
  )
}
