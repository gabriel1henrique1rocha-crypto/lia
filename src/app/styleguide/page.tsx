import { notFound } from 'next/navigation'
import { BookOpen, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Link } from '@/components/ui/Link'
import { Card } from '@/components/ui/Card'

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

/* ── página ────────────────────────────────────────────────────────── */

export default function StyleguidePage() {
  if (process.env.ENABLE_STYLEGUIDE !== 'true') {
    notFound()
  }

  return (
    <div
      className="mx-auto px-5 py-6"
      style={{ maxWidth: 'var(--container-md)' }}
    >
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
            <Field
              as="textarea"
              label="Resenha"
              placeholder="Escreva sua resenha aqui…"
              rows={5}
            />
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
    </div>
  )
}
