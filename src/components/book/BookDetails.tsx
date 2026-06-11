// Sem 'use client': BookDetails é puramente apresentacional (sem hooks/eventos),
// renderizado no servidor (BOOK-12 AC#4). Segue o padrão do Card.
import { createElement, Fragment, type ReactNode } from 'react'
import type { BookView } from '@/lib/book/queries'
import { languageLabel } from '@/lib/book/language'
import { formatIsbn } from '@/lib/book/isbn'

interface BookDetailsProps {
  book: BookView
  /** Nível do heading do bloco "Tradução". Padrão 3 — ajuste à hierarquia da página. */
  headingLevel?: 2 | 3 | 4
}

interface DetailRow {
  label: string
  value: ReactNode
}

/**
 * Ficha técnica do livro com marcação semântica `<dl>/<dt>/<dd>` (DD-6).
 * Omite pares de campos opcionais ausentes (sem `<dt>` órfão — BOOK-12 AC#2).
 *
 * SPEC_DEVIATION: o bloco "Tradução" é um irmão da `<dl>` principal, não um
 * filho dela.
 * Reason: um heading não é conteúdo válido dentro de `<dl>` (regra axe
 * `definition-list`); aninhá-lo geraria violação de acessibilidade. O heading +
 * sub-`<dl>` ficam num `<div>` adjacente, preservando a semântica do grupo.
 */
export function BookDetails({ book, headingLevel = 3 }: BookDetailsProps) {
  const fields: DetailRow[] = [{ label: 'Autor', value: book.author }]
  if (book.genre?.name) fields.push({ label: 'Gênero', value: book.genre.name })
  if (book.publisher) fields.push({ label: 'Editora', value: book.publisher })
  if (book.year != null) fields.push({ label: 'Ano', value: String(book.year) })
  if (book.pages != null) fields.push({ label: 'Páginas', value: String(book.pages) })
  if (book.original_language)
    fields.push({ label: 'Idioma original', value: languageLabel(book.original_language) })
  if (book.isbn) fields.push({ label: 'ISBN', value: formatIsbn(book.isbn) })

  const hasTranslation = Boolean(book.translator)

  return (
    <>
      <dl className="lia-book-details">
        {fields.map(({ label, value }) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>

      {hasTranslation && (
        <div className="lia-book-details__group">
          {createElement(
            `h${headingLevel}`,
            { className: 'lia-book-details__group-title' },
            'Tradução'
          )}
          <dl className="lia-book-details">
            <dt>Tradutor</dt>
            <dd>{book.translator}</dd>
            {book.translated_from && (
              <>
                <dt>Idioma de origem</dt>
                <dd>{languageLabel(book.translated_from)}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </>
  )
}
