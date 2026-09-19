import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LIACast · OLDA',
  description: 'O podcast do grupo de pesquisa Leituras Inclusivas e Anticapacitistas (LIA).',
}

const SPOTIFY_URL = 'https://open.spotify.com/show/033PtdAZjM7W0PhzXdHD9p'

/**
 * LIACast — página mínima com o link do podcast (doc de customização, item 5).
 * Link simples em vez de embed: sem iframe de terceiro, nada a quebrar no axe,
 * e o nome acessível já diz para onde vai e que abre fora do site.
 */
export default function LIACastPage() {
  return (
    <div className="lia-placeholder">
      <h1 className="lia-placeholder__title">LIACast</h1>
      <p className="lia-placeholder__text">
        O podcast do grupo de pesquisa Leituras Inclusivas e Anticapacitistas (LIA).
      </p>
      <p>
        <a className="lia-link" href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
          Ouvir o LIACast no Spotify (abre em nova aba)
        </a>
      </p>
    </div>
  )
}
