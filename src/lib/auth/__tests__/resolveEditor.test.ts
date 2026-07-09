import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { resolveEditor, isAdmin } from '../resolveEditor'

type EditorRow = { id: string; role: 'admin' | 'editor'; active: boolean } | null

// Client stub mínimo: getUser + from().select().eq().maybeSingle().
function stubClient(user: { id: string } | null, editor: EditorRow): SupabaseClient<Database> {
  return {
    auth: {
      async getUser() {
        return { data: { user }, error: user ? null : { message: 'no session' } }
      },
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: editor, error: null }
                },
              }
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient<Database>
}

const U = { id: 'uid-1' }

describe('resolveEditor (SEC-07/08/09)', () => {
  it('sem sessão → unauthenticated', async () => {
    expect(await resolveEditor(stubClient(null, null))).toEqual({ status: 'unauthenticated' })
  })

  it('sessão mas SEM linha editor (auth.users órfão) → forbidden', async () => {
    expect(await resolveEditor(stubClient(U, null))).toEqual({ status: 'forbidden' })
  })

  it('editor com active=false → forbidden (F-7/F-8)', async () => {
    const r = await resolveEditor(stubClient(U, { id: 'uid-1', role: 'editor', active: false }))
    expect(r).toEqual({ status: 'forbidden' })
  })

  it('editor ativo → ok com papel', async () => {
    const r = await resolveEditor(stubClient(U, { id: 'uid-1', role: 'editor', active: true }))
    expect(r).toEqual({ status: 'ok', editor: { id: 'uid-1', role: 'editor' } })
  })

  it('admin ativo → ok com papel admin', async () => {
    const r = await resolveEditor(stubClient(U, { id: 'uid-1', role: 'admin', active: true }))
    expect(r).toEqual({ status: 'ok', editor: { id: 'uid-1', role: 'admin' } })
  })

  it('não vaza campos além de id/role no retorno ok', async () => {
    const r = await resolveEditor(stubClient(U, { id: 'uid-1', role: 'admin', active: true }))
    if (r.status === 'ok') expect(Object.keys(r.editor).sort()).toEqual(['id', 'role'])
  })

  it('isAdmin: true só para ok+admin', async () => {
    expect(isAdmin({ status: 'ok', editor: { id: 'x', role: 'admin' } })).toBe(true)
    expect(isAdmin({ status: 'ok', editor: { id: 'x', role: 'editor' } })).toBe(false)
    expect(isAdmin({ status: 'forbidden' })).toBe(false)
    expect(isAdmin({ status: 'unauthenticated' })).toBe(false)
  })
})
