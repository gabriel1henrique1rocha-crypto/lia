import { notFound } from 'next/navigation'
import { BookOpen, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Link } from '@/components/ui/Link'
import { Card } from '@/components/ui/Card'
import { BookDetails } from '@/components/book/BookDetails'
import { HighlightQuote } from '@/components/review/HighlightQuote'
import { ReviewTags } from '@/components/review/ReviewTags'
import { ReviewFormDemo } from './ReviewFormDemo'
import {
  EditorReviewsTable,
  EmptyReviews,
} from '@/app/admin/(protected)/resenhas/EditorReviewsTable'
import type { EditorReviewListItem } from '@/lib/review/adminQueries'
import type { BookView } from '@/lib/book/queries'

/**
 * Rota de auditoria a11y. Só acessível quando ENABLE_STYLEGUIDE=true (server-side).
 * Nunca exposta em produção — omitir a var de ambiente retorna 404 em tempo de requisição.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Guia de estilos · LIA',
  robots: { index: false, follow: false },
}

/* ── helpers de layout ─────────────────────────────────────────────── */

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="py-6 border-b border-[var(--border-subtle)] last:border-0"
    >
      <h2
        id={`${id}-heading`}
        className="mb-5 font-semibold text-[var(--text-strong)]"
        style={{ fontSize: 'var(--text-xl)' }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-3 text-xs font-medium uppercase text-[var(--text-muted)]"
        style={{ letterSpacing: 'var(--tracking-caps)' }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-3 items-start">{children}</div>
    </div>
  )
}

/* ── mocks da Ficha (dados ilustrativos; não dependem do banco) ──────── */

// O ISBN abaixo tem checksum válido (9783161484100) e serve só para demonstrar
// a formatação — não é o ISBN real da obra.
const fichaCompleta: BookView = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'O Nome da Rosa',
  author: 'Umberto Eco',
  genre_id: '20000000-0000-4000-8000-000000000001',
  publisher: 'Editora Record',
  isbn: '9783161484100',
  cover_url: null,
  year: 1980,
  pages: 512,
  original_language: 'it',
  translator: null,
  translated_from: null,
  publication_city: 'Rio de Janeiro',
  created_at: '2024-01-01T00:00:00Z',
  genre: { name: 'Romance', slug: 'romance' },
}

const fichaMinima: BookView = {
  id: '10000000-0000-4000-8000-000000000002',
  title: 'Iracema',
  author: 'José de Alencar',
  genre_id: '20000000-0000-4000-8000-000000000002',
  publisher: null,
  isbn: null,
  cover_url: null,
  year: null,
  pages: null,
  original_language: null,
  translator: null,
  translated_from: null,
  publication_city: null,
  created_at: '2024-01-01T00:00:00Z',
  genre: { name: 'Romantismo', slug: 'romantismo' },
}

const fichaTraducao: BookView = {
  id: '10000000-0000-4000-8000-000000000003',
  title: 'Crime e Castigo',
  author: 'Fiódor Dostoiévski',
  genre_id: '20000000-0000-4000-8000-000000000001',
  publisher: 'Editora 34',
  isbn: null,
  cover_url: null,
  year: 1866,
  pages: 608,
  original_language: 'ru',
  translator: 'Paulo Bezerra',
  translated_from: 'ru',
  publication_city: null,
  created_at: '2024-01-01T00:00:00Z',
  genre: { name: 'Romance', slug: 'romance' },
}

const fichaCardStyle = { width: '26rem', maxWidth: '100%', gap: 'var(--spacing-4)' }

/* ── mocks da lista do painel (T10) ─────────────────────────────────── */

// Datas FIXAS: a tabela formata com fuso fixo, então a saída é determinística —
// o axe audita sempre exatamente o mesmo texto.
const resenhasDoEditor: EditorReviewListItem[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    title: 'A biblioteca como labirinto',
    slug: 'a-biblioteca-como-labirinto',
    status: 'draft',
    published_at: null,
    updated_at: '2026-08-24T18:30:00Z',
    book: { title: 'O Nome da Rosa' },
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    title: 'Iracema, entre a lenda e a língua',
    slug: 'iracema-entre-a-lenda-e-a-lingua',
    status: 'published',
    published_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-08-20T12:00:00Z',
    book: { title: 'Iracema' },
  },
]

/* ── página ────────────────────────────────────────────────────────── */

export default function StyleguidePage() {
  if (process.env.ENABLE_STYLEGUIDE !== 'true') {
    notFound()
  }

  return (
    <div className="mx-auto px-5 py-6" style={{ maxWidth: 'var(--container-md)' }}>
      <h1
        className="mb-8 font-bold text-[var(--text-strong)]"
        style={{ fontSize: 'var(--text-3xl)' }}
      >
        Guia de estilos
      </h1>

      {/* ── Button ───────────────────────────────────────────────── */}
      <Section id="btn" title="Button">
        <Row label="Variantes">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </Row>

        <Row label="Tamanhos (alvo mínimo 44 px no md)">
          <Button size="sm">Small</Button>
          <Button size="md">Medium (padrão)</Button>
          <Button size="lg">Large</Button>
        </Row>

        <Row label="Com ícone">
          <Button variant="primary" icon={<BookOpen size={16} />}>
            Ler resenha
          </Button>
          <Button variant="secondary" icon={<Star size={16} />} iconPosition="end">
            Favoritar
          </Button>
        </Row>

        <Row label="Desabilitado via aria-disabled (mantém foco no Tab)">
          <Button variant="primary" disabled>
            Primary
          </Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
          <Button variant="ghost" disabled>
            Ghost
          </Button>
        </Row>
      </Section>

      {/* ── Field ────────────────────────────────────────────────── */}
      <Section id="field" title="Field">
        <Row label="Input padrão">
          <div style={{ width: '20rem' }}>
            <Field label="Título do livro" placeholder="Ex.: O Nome da Rosa" />
          </div>
        </Row>

        <Row label="Com texto auxiliar">
          <div style={{ width: '20rem' }}>
            <Field
              label="Slug"
              placeholder="o-nome-da-rosa"
              helpText="Usado na URL da resenha. Apenas letras minúsculas, números e hífens."
            />
          </div>
        </Row>

        <Row label="Estado de erro — aria-invalid + role=alert + ícone aria-hidden">
          <div style={{ width: '20rem' }}>
            <Field
              label="E-mail"
              type="email"
              defaultValue="nao-e-um-email"
              error="Endereço de e-mail inválido."
              required
            />
          </div>
        </Row>

        <Row label="Textarea">
          <div style={{ width: '24rem' }}>
            <Field as="textarea" label="Resenha" placeholder="Escreva sua resenha aqui…" rows={5} />
          </div>
        </Row>

        <Row label="Select com chevron decorativo">
          <div style={{ width: '20rem' }}>
            <Field as="select" label="Gênero literário">
              <option value="">Selecione…</option>
              <option value="romance">Romance</option>
              <option value="ficcao">Ficção científica</option>
              <option value="policial">Policial</option>
              <option value="ensaio">Ensaio</option>
            </Field>
          </div>
        </Row>
      </Section>

      {/* ── Link ─────────────────────────────────────────────────── */}
      <Section id="link" title="Link">
        <Row label="Default (sempre sublinhado — significado não depende de cor)">
          <Link href="#">Ver resenha completa</Link>
        </Row>

        <Row label="Externo (nova aba · rel noopener · ícone ExternalLink aria-hidden)">
          <Link href="https://example.com" external>
            Fonte na Wikipédia
          </Link>
        </Row>

        <Row label="Quiet (sublinha só no hover — uso restrito a contextos densos)">
          <Link href="#" variant="quiet">
            Link discreto
          </Link>
        </Row>
      </Section>

      {/* ── Card ─────────────────────────────────────────────────── */}
      <Section id="card" title="Card">
        <Row label="Outline (padrão)">
          <Card className="p-5" style={{ width: '16rem' }}>
            <Card.Eyebrow>Romance</Card.Eyebrow>
            <Card.Title>O Nome da Rosa</Card.Title>
            <Card.Excerpt>Umberto Eco · 1980</Card.Excerpt>
          </Card>
        </Row>

        <Row label="Raised (sombra elevada)">
          <Card variant="raised" className="p-5" style={{ width: '16rem' }}>
            <Card.Eyebrow>Ficção científica</Card.Eyebrow>
            <Card.Title>Neuromancer</Card.Title>
            <Card.Excerpt>William Gibson · 1984</Card.Excerpt>
          </Card>
        </Row>

        <Row label="Flat (sem borda nem sombra)">
          <Card variant="flat" className="p-5" style={{ width: '16rem' }}>
            <Card.Eyebrow>Policial</Card.Eyebrow>
            <Card.Title>O Falcão Maltês</Card.Title>
            <Card.Excerpt>Dashiell Hammett · 1930</Card.Excerpt>
          </Card>
        </Row>

        <Row label="Clicável como <a> — Tab + Enter/Space · anel de foco visível">
          <Card href="#card" variant="raised" className="p-5" style={{ width: '16rem' }}>
            <Card.Eyebrow>Drama</Card.Eyebrow>
            <Card.Title>Grande Sertão: Veredas</Card.Title>
            <Card.Excerpt>Guimarães Rosa · 1956</Card.Excerpt>
            <Card.Footer>
              <span className="lia-link" style={{ fontSize: 'var(--text-sm)' }}>
                Ver resenha →
              </span>
            </Card.Footer>
          </Card>
        </Row>
      </Section>

      {/* ── Lista do painel (T10) ────────────────────────────────── */}
      {/* Montada aqui pelo mesmo motivo do formulário: a rota real vive sob
          `(protected)` e exige sessão, que o CI não tem como abrir (TD-02).
          O componente é o mesmo — só os dados são de mentira. */}
      <Section id="admin-reviews" title="Painel — lista de resenhas">
        <Row label="Com resenhas (rascunho + publicada)">
          <div style={{ width: '100%' }}>
            <EditorReviewsTable reviews={resenhasDoEditor} />
          </div>
        </Row>

        <Row label="Editor sem nenhuma resenha — convite, não tabela vazia">
          <div style={{ width: '100%' }}>
            <EmptyReviews />
          </div>
        </Row>
      </Section>

      {/* ── Exibição pública da resenha (T11/T12) ────────────────── */}
      {/* Montados aqui porque a rota `/resenha/[slug]` depende de uma resenha
          PUBLICADA no banco, e o axe do CI roda sem Supabase (TD-02). Os
          componentes são os mesmos; a estrutura da página inteira é auditada
          em jsdom, no teste de unidade da rota. */}
      <Section id="review-public" title="Resenha pública — campos novos">
        <Row label="Frase de destaque — figure + blockquote + figcaption">
          <div style={{ width: '100%', maxWidth: 'var(--container-prose)' }}>
            <HighlightQuote quote="A biblioteca é um labirinto que se lê com os pés." />
          </div>
        </Row>

        <Row label="Tags — lista, SEM link (o filtro não existe: TAGS=c / D-12)">
          <div style={{ width: '100%' }}>
            <ReviewTags tags={['romance histórico', 'medievo', 'metaficção']} />
          </div>
        </Row>

        <Row label="Assinatura de quem resenha — rótulo explícito, não é o autor do livro">
          <div style={{ width: '100%' }}>
            <p className="lia-review__subject">
              Sobre <cite>O Nome da Rosa</cite>, de Umberto Eco
            </p>
            <p className="lia-review__byline">Resenha por Ana Ribeiro</p>
          </div>
        </Row>
      </Section>

      {/* ── Formulário de resenha (T8) ───────────────────────────── */}
      {/* Montado aqui, e não numa rota nova (isso é T10), para o axe e o teste
          de teclado rodarem em navegador real contra o componente de verdade. */}
      <Section id="review-form" title="Formulário de resenha">
        <ReviewFormDemo />
      </Section>

      {/* ── Ficha do Livro (BookDetails) ─────────────────────────── */}
      <Section id="ficha" title="Ficha do Livro">
        <Row label="Completa — todos os campos + ISBN formatado">
          <Card className="p-5" style={fichaCardStyle}>
            <Card.Title as="h3">{fichaCompleta.title}</Card.Title>
            <BookDetails book={fichaCompleta} headingLevel={4} />
          </Card>
        </Row>

        <Row label="Mínima — só obrigatórios (opcionais omitidos do dl)">
          <Card className="p-5" style={fichaCardStyle}>
            <Card.Title as="h3">{fichaMinima.title}</Card.Title>
            <BookDetails book={fichaMinima} headingLevel={4} />
          </Card>
        </Row>

        <Row label="Com tradução — bloco irmão da dl (heading + sub-dl)">
          <Card className="p-5" style={fichaCardStyle}>
            <Card.Title as="h3">{fichaTraducao.title}</Card.Title>
            <BookDetails book={fichaTraducao} headingLevel={4} />
          </Card>
        </Row>
      </Section>
    </div>
  )
}
