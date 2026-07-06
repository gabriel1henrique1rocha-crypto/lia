import type { Metadata } from 'next'
import Link from 'next/link'
import { Spectral, Newsreader, IBM_Plex_Sans } from 'next/font/google'
import { SiteFooter } from '@/components/listing/SiteFooter'
import './globals.css'

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-spectral',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-newsreader',
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-ibm-plex-sans',
})

// Base para URLs absolutas de metadata (og:url, canonical). Sem ela, URLs
// relativas de generateMetadata (ex.: /resenha/<slug>) não resolvem absolutas.
// Env com fallback local determinístico (sem hardcode de domínio de produção).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'LIA — Leituras e impressões anotadas',
  description: 'Resenhas e anotações de leitura.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spectral.variable} ${newsreader.variable} ${ibmPlexSans.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-ink-900"
        >
          Ir para o conteúdo principal
        </a>
        <header className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <Link
            href="/"
            className="font-display font-semibold text-base text-ink-900 no-underline"
            aria-label="LIA — página inicial"
          >
            LIA
          </Link>
        </header>
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
