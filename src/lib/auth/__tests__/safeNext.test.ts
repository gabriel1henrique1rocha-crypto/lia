import { describe, it, expect } from 'vitest'
import { safeNext } from '../safeNext'

describe('safeNext (open redirect, F-10)', () => {
  it('aceita caminhos internos relativos', () => {
    expect(safeNext('/admin')).toBe('/admin')
    expect(safeNext('/admin/resenhas')).toBe('/admin/resenhas')
    expect(safeNext('/admin?x=1')).toBe('/admin?x=1')
  })

  it('cai no default seguro quando ausente/vazio', () => {
    expect(safeNext(null)).toBe('/admin')
    expect(safeNext(undefined)).toBe('/admin')
    expect(safeNext('')).toBe('/admin')
  })

  it('REJEITA protocol-relative (host externo)', () => {
    expect(safeNext('//evil.com')).toBe('/admin')
    expect(safeNext('//evil.com/path')).toBe('/admin')
  })

  it('REJEITA URL absoluta / esquema', () => {
    expect(safeNext('https://evil.com')).toBe('/admin')
    expect(safeNext('http://evil.com')).toBe('/admin')
    expect(safeNext('javascript:alert(1)')).toBe('/admin')
  })

  it('REJEITA backslash e byte nulo', () => {
    expect(safeNext('/\\evil.com')).toBe('/admin')
    expect(safeNext('\\\\evil.com')).toBe('/admin')
    expect(safeNext('/admin\0/x')).toBe('/admin')
  })
})
