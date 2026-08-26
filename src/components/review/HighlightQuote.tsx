/**
 * Frase de destaque da resenha (`review.highlight_quote`, REV-11 / design §7).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A MARCAÇÃO, E POR QUE ELA É ESTA
 *
 * O design pede "`<blockquote>` com realce". `<blockquote>` sozinho, porém, não
 * responde a pergunta que o leitor de tela faz ao chegar nele: **citação de
 * quê?** Um bloco citado sem contexto, logo no início de uma resenha sobre um
 * livro, é lido com naturalidade como uma passagem DO LIVRO — e nada no dado
 * autoriza essa leitura.
 *
 * O QUE O SCHEMA PERMITE AFIRMAR: `highlight_quote` é uma coluna de `review`,
 * ao lado de `title` e `body`, no grupo "Conteúdo" da spec. Não existe coluna de
 * fonte, de autor, de página. **Sem campo de atribuição, uma citação de obra
 * externa não pode ser atribuída** — e citação de obra sem atribuição, num
 * produto modelado em ABNT, seria o defeito, não a feature. A leitura que o dado
 * sustenta é a outra: um trecho que o editor escolheu ERGUER do próprio texto.
 *
 * Daí `<figure>` + `<figcaption>`, que é o padrão do HTML para "bloco citado com
 * legenda": o `figcaption` dá NOME ACESSÍVEL à figura, então o leitor anuncia
 * "figura, Trecho em destaque" ANTES da frase, e a ambiguidade morre sem que se
 * invente uma atribuição que o banco não tem.
 *
 * A legenda é "Trecho em destaque", não "Citação do livro" nem "Destaque da
 * resenha": as duas últimas AFIRMAM uma origem. "Trecho em destaque" diz o que é
 * verdade sob qualquer leitura — alguém destacou isto —, sem atribuir autoria.
 *
 * SEM `<cite>`: `<cite>` marca o TÍTULO de uma obra, não quem falou. Usá-lo aqui
 * seria erro de semântica, e não há título a citar.
 *
 * SEM `aria-hidden`: um destaque que repete uma frase do corpo é lido duas vezes
 * pelo leitor de tela, e a prática comum para *pull quotes* é escondê-los da
 * árvore. Aqui NÃO dá para fazer isso: o campo é texto livre e o editor pode ter
 * escrito algo que não está no corpo. Esconder economizaria uma repetição ao
 * custo de APAGAR conteúdo único — e apagar conteúdo é o erro mais caro dos
 * dois. A legenda torna a eventual repetição explicável em vez de confusa.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ausente (null, vazio ou só espaço) → NÃO RENDERIZA NADA: sem legenda órfã,
 * sem moldura vazia, sem espaço reservado (REV-11). As 5 resenhas em produção
 * caem neste caminho.
 */
export function HighlightQuote({ quote }: { quote: string | null | undefined }) {
  const frase = quote?.trim()
  if (!frase) return null

  return (
    <figure className="lia-highlight">
      <blockquote className="lia-highlight__quote">
        <p>{frase}</p>
      </blockquote>
      <figcaption className="lia-highlight__caption">Trecho em destaque</figcaption>
    </figure>
  )
}
