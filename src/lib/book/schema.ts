import { z } from 'zod'
import { isValidIsbn } from './isbn'

/**
 * Contrato único de validação da ficha do livro (DD-1). É a superfície
 * primária de validação da app — reutilizada pelos testes, pelo seed
 * (typecheck) e pelo formulário de admin (M2). As CHECK constraints do
 * Postgres (migration 0002) são defesa em profundidade.
 *
 * Idioma em código ISO 639-1 (`originalLanguage`/`translatedFrom`) — ver
 * `language.ts`. Checksum de ISBN e regra "ano não futuro" vivem aqui (não
 * são expressáveis como CHECK imutável — DD-3).
 */
const currentYear = new Date().getFullYear()

export const bookInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Título é obrigatório'),
    author: z.string().trim().min(1, 'Autor é obrigatório'),
    genreId: z.string().uuid('Gênero inválido'),
    publisher: z.string().trim().optional(),
    isbn: z.string().trim().optional(),
    coverUrl: z.string().url('URL de capa inválida').optional(),
    year: z
      .number()
      .int()
      .min(1, 'Ano inválido')
      .max(currentYear, `Ano não pode ser futuro (máximo ${currentYear})`)
      .optional(),
    pages: z.number().int().positive('Número de páginas deve ser maior que zero').optional(),
    originalLanguage: z.string().trim().optional(),
    translator: z.string().trim().optional(),
    translatedFrom: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // (a) ISBN é opcional, mas se presente deve ter checksum válido (BOOK-05/07).
    if (data.isbn && !isValidIsbn(data.isbn)) {
      ctx.addIssue({
        code: 'custom',
        path: ['isbn'],
        message: 'ISBN inválido (verifique o checksum e o comprimento)',
      })
    }
    // (b) Havendo tradutor, o idioma de origem é obrigatório (BOOK-10).
    if (data.translator && !data.translatedFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['translatedFrom'],
        message: 'Informe o idioma de origem quando houver tradutor',
      })
    }
  })

export type BookInput = z.infer<typeof bookInputSchema>
