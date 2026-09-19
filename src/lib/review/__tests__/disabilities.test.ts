import { describe, it, expect } from 'vitest'
import { disabilitiesOf } from '../disabilities'
import { readDisabilityIds, readReviewForm } from '../formData'
import { reviewDraftSchema, toCreateReviewRpcArgs, toUpdateReviewRpcArgs } from '../schema'
import { parseListingParams, buildListingHref } from '../listingParams'

/** D-12 — regras puras: leitura do FormData, schema, ponte do RPC, URL. */

const GENRE = '11111111-1111-4111-8111-111111111111'
const FISICA = 'a1111111-1111-4111-8111-111111111111'
const TEA = 'a2222222-2222-4222-8222-222222222222'

function form(pares: [string, string][]) {
  const fd = new FormData()
  for (const [k, v] of pares) fd.append(k, v)
  return fd
}

describe('readDisabilityIds', () => {
  it('sem o marcador → undefined ("não mexer")', () => {
    expect(readDisabilityIds(form([['disabilityIds', FISICA]]))).toBeUndefined()
  })

  it('com marcador e nada marcado → [] ("limpar")', () => {
    expect(readDisabilityIds(form([['disabilityIdsSent', '1']]))).toEqual([])
  })

  it('colapsa repetidos e ignora vazio', () => {
    const fd = form([
      ['disabilityIdsSent', '1'],
      ['disabilityIds', FISICA],
      ['disabilityIds', FISICA],
      ['disabilityIds', ''],
      ['disabilityIds', TEA],
    ])
    expect(readDisabilityIds(fd)).toEqual([FISICA, TEA])
  })
})

describe('schema + ponte do RPC', () => {
  const base = { title: 'Dom Casmurro', author: 'Machado de Assis', genreId: GENRE }

  it('id que não é UUID é recusado no campo', () => {
    const r = reviewDraftSchema.safeParse({ ...base, disabilityIds: ['nao-e-uuid'] })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path.slice(0, 1)).toEqual(['disabilityIds'])
  })

  it('create: ausente → p_disability_ids null; lista → a lista', () => {
    const semGrupo = reviewDraftSchema.parse(base)
    expect(toCreateReviewRpcArgs(semGrupo, 'x', 'draft').p_disability_ids).toBeNull()

    const comGrupo = reviewDraftSchema.parse({ ...base, disabilityIds: [TEA] })
    expect(toCreateReviewRpcArgs(comGrupo, 'x', 'draft').p_disability_ids).toEqual([TEA])
  })

  it('update: [] é enviado como [] (limpar), NÃO como null (não mexer)', () => {
    const vazio = reviewDraftSchema.parse({ ...base, disabilityIds: [] })
    const args = toUpdateReviewRpcArgs(
      vazio,
      'rev',
      '2026-01-01T00:00:00.000001+00:00',
      null,
      'draft'
    )
    expect(args.p_disability_ids).toEqual([])
  })

  it('readReviewForm → schema: o caminho completo do FormData', () => {
    const fd = form([
      ['title', 'Dom Casmurro'],
      ['author', 'Machado de Assis'],
      ['genreId', GENRE],
      ['disabilityIdsSent', '1'],
      ['disabilityIds', FISICA],
    ])
    expect(reviewDraftSchema.parse(readReviewForm(fd)).disabilityIds).toEqual([FISICA])
  })
})

describe('disabilitiesOf', () => {
  it('descarta termo desativado (null) e ordena por sort_order', () => {
    expect(
      disabilitiesOf({
        review_disability: [
          { term: { name: 'TEA', slug: 'tea', sort_order: 60 } },
          { term: null },
          { term: { name: 'Deficiência física', slug: 'deficiencia-fisica', sort_order: 10 } },
        ],
      }).map((t) => t.slug)
    ).toEqual(['deficiencia-fisica', 'tea'])
  })

  it('sem vínculos → []', () => {
    expect(disabilitiesOf({})).toEqual([])
    expect(disabilitiesOf({ review_disability: null })).toEqual([])
  })
})

describe('?deficiencia= na URL (DIS-07)', () => {
  it('slug válido é lido; inválido degrada para sem filtro', () => {
    expect(parseListingParams({ deficiencia: 'tea' }).deficiencia).toBe('tea')
    expect(parseListingParams({ deficiencia: ' deficiencia-fisica ' }).deficiencia).toBe(
      'deficiencia-fisica'
    )
    expect(parseListingParams({ deficiencia: "x'; drop" }).deficiencia).toBe('')
    expect(parseListingParams({ deficiencia: 'TEA' }).deficiencia).toBe('')
  })

  it('buildListingHref preserva o filtro (paginação e "limpar" dependem disso)', () => {
    const params = parseListingParams({ deficiencia: 'tea', pagina: '2' })
    expect(buildListingHref(params)).toBe('/?deficiencia=tea&pagina=2')
    expect(buildListingHref(params, { pagina: 1 })).toBe('/?deficiencia=tea')
  })
})
