/**
 * Capa do livro em DUAS VARIANTES, com o MESMO contrato acessível.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE COMPONENTE NÃO DECIDE: O TAMANHO
 *
 * A capa não tem tamanho próprio — quem o define é o contexto. `.lia-card__media`
 * traz `width:100%` + `aspect-ratio`, e isso só é uma medida quando ALGUÉM acima
 * limita a largura. Numa célula da grade da home (~350px) rende ~233px de
 * altura; solta como filha direta do `<article>` da rota `/resenha/[slug]`, que
 * não tinha regra de container nenhuma, rendia **853px a 1280px de viewport** —
 * o "bloco vinho" que abria a página antes do conteúdo.
 *
 * A correção mora no CSS do CONTEXTO (`.lia-review__cover`), não aqui: a regra
 * de mídia do cartão não está errada, faltava o container. Este componente
 * continua sem opinião sobre largura, de propósito — é o que o deixa reusável
 * na grade e na página de resenha ao mesmo tempo.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COM `coverUrl` → `<img>` de verdade. Só EXIBIÇÃO de uma URL que a validação
 * já restringiu a http/https (A-4, `bookInputSchema`): o pipeline de UPLOAD e
 * storage segue sendo de `storage-covers` (RVW-12), nada aqui o antecipa.
 *
 * SEM `coverUrl` → capa TIPOGRÁFICA de fallback: o título sobre o fundo de
 * marca (o estado de 100% das resenhas em produção hoje).
 *
 * Acessibilidade: as duas variantes expõem a MESMA alternativa textual
 * ("Capa de <título>") — `alt` no `<img>`, `role="img"` + `aria-label` no
 * fallback, que não é elemento de imagem. Trocar de variante não muda o que o
 * leitor de tela anuncia.
 */
export function BookCover({ title, coverUrl }: { title: string; coverUrl?: string | null }) {
  const src = coverUrl?.trim()

  if (src) {
    // `<img>` e não `next/image`: o otimizador exige `images.remotePatterns` com
    // os hosts de capa declarados, e hoje `cover_url` aceita qualquer host
    // http/https. Declarar hosts é decisão do pipeline de storage (RVW-12) —
    // aqui é exibição pura, sem config nova. A caixa já é reservada pela
    // `aspect-ratio` do container, então não há salto de layout a compensar.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="lia-card__media"
        src={src}
        alt={`Capa de ${title}`}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <span
      className="lia-card__media lia-card__media--type"
      role="img"
      aria-label={`Capa de ${title}`}
    >
      {title}
    </span>
  )
}
