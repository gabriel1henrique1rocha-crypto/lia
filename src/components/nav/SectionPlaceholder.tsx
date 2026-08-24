/**
 * Página de seção DECLARADA porém ainda vazia (Server Component, sem dados).
 *
 * Honestidade em vez de fachada: um `<h1>` com o nome real da seção e uma frase
 * única declarando o status. Sem "lorem ipsum", sem conteúdo fictício, sem
 * `noindex` — a página não engana ninguém, só ainda não tem o que mostrar.
 *
 * `role="status"` NÃO é usado: o texto já está presente no carregamento, não é
 * uma atualização dinâmica — anunciá-lo como live region seria ruído.
 */

/** Frase de status — idêntica nas cinco seções, por decisão de conteúdo. */
export const PLACEHOLDER_TEXT = 'Esta seção está em construção e será publicada em breve.'

export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="lia-placeholder">
      <h1 className="lia-placeholder__title">{title}</h1>
      <p className="lia-placeholder__text">{PLACEHOLDER_TEXT}</p>
    </div>
  )
}
