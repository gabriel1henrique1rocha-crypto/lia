import type { Metadata } from 'next'
import Link from 'next/link'
import { Atkinson_Hyperlegible, Fraunces } from 'next/font/google'
import { SiteFooter } from '@/components/listing/SiteFooter'
import { SiteNav } from '@/components/nav/SiteNav'
import './globals.css'

/**
 * Identidade D-13b (HOME-02). Fraunces só nos pesos que o sistema usa (500/600);
 * Atkinson Hyperlegible — desenhada para leitura com baixa visão — para corpo e
 * UI, 400/700 (a família não tem 500: ver A-3 nos tokens).
 */
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-fraunces',
})

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-atkinson',
})

// Base para URLs absolutas de metadata (og:url, canonical). Sem ela, URLs
// relativas de generateMetadata (ex.: /resenha/<slug>) não resolvem absolutas.
// Env com fallback local determinístico (sem hardcode de domínio de produção).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'OLDA — Observatório Anticapacitista de Literatura e Deficiência',
  description: 'Mapeamento crítico das representações da deficiência na literatura ocidental.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${atkinson.variable}`}>
      <body>
        <a href="#main" className="lia-skip-link">
          Ir para o conteúdo principal
        </a>
        {/* Ordem no DOM = ordem de tabulação: skip link → marca → navegação →
            conteúdo. O skip link segue pulando TUDO isto de uma vez.
            HOME-07: marca à esquerda, navegação à direita (CSS). */}
        <header className="lia-site-header">
          <Link href="/" className="lia-site-header__brand" aria-label="OLDA — página inicial">
            OLDA
          </Link>
          <SiteNav />
        </header>
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
