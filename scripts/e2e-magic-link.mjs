// Verificação end-to-end LOCAL do fluxo de auth (security-foundation, T19).
// NÃO roda no CI. Dirige o app real (next dev) contra o Supabase local + Mailpit:
//   login → e-mail (Mailpit) → /auth/confirm → sessão httpOnly → gate /admin.
// Prova D-10 (cookies httpOnly/SameSite=Lax) e o gate (sem sessão → login).
//
// Fala direto com a API (GoTrue/fetch) — sem @supabase/supabase-js (que exige
// WebSocket em Node). Segredos só de env (não hardcoded). Uso:
//   LOCAL_URL, LOCAL_ANON, LOCAL_SECRET, APP_URL, MAILPIT_URL, DB_CONTAINER.
// Pré: `next dev` no APP_URL apontando ao Supabase local; stack local UP.
import { execSync } from 'node:child_process'

const LOCAL_URL = process.env.LOCAL_URL ?? 'http://127.0.0.1:54321'
const LOCAL_ANON = process.env.LOCAL_ANON
const LOCAL_SECRET = process.env.LOCAL_SECRET
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'supabase_db_lia'
const EMAIL = 'e2e-admin@lia.test'

if (!LOCAL_ANON || !LOCAL_SECRET) throw new Error('Defina LOCAL_ANON e LOCAL_SECRET.')

const psql = (sql) =>
  execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

const adminHeaders = {
  apikey: LOCAL_SECRET,
  Authorization: `Bearer ${LOCAL_SECRET}`,
  'Content-Type': 'application/json',
}

const results = []
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail })
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function listUsers() {
  const r = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: adminHeaders,
  })
  const j = await r.json()
  return j.users ?? []
}
async function cleanup() {
  const u = (await listUsers()).find((x) => x.email === EMAIL)
  if (u) {
    await fetch(`${LOCAL_URL}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
  }
}

async function main() {
  await cleanup()

  // 1) Bootstrap do admin de teste (caminho privilegiado, como o runbook C-4).
  const createRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email: EMAIL, email_confirm: true }),
  })
  const created = await createRes.json()
  const uid = created.id
  check('admin de teste criado (auth.users)', !!uid)
  psql(
    `insert into public.editor (id, email, name, role, active) values ('${uid}','${EMAIL}','E2E Admin','admin',true);`
  )

  // 2) Solicita o magic link (o que a server action faz): conjunto fechado.
  const otpRes = await fetch(`${LOCAL_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: LOCAL_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, create_user: false }),
  })
  check(
    'signInWithOtp aceito (usuário existente, create_user:false)',
    otpRes.ok,
    `status=${otpRes.status}`
  )

  // 3) Recupera o e-mail no Mailpit e extrai token_hash + type.
  let token, type
  for (let i = 0; i < 20 && !token; i++) {
    await sleep(500)
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=20`).then((r) => r.json())
    const msg = (list.messages ?? []).find((m) => (m.To ?? []).some((t) => t.Address === EMAIL))
    if (!msg) continue
    const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json())
    const body = `${full.Text ?? ''} ${full.HTML ?? ''}`
    const m = body.match(/token=([^&"'\s]+)[^"'\s]*?type=([a-z_]+)/i)
    if (m) {
      token = m[1]
      type = m[2]
    }
  }
  check('magic link recebido no Mailpit (token extraído)', !!token, type ? `type=${type}` : '')
  if (!token) throw new Error('token não encontrado no e-mail')

  // 4) Callback real do app: /auth/confirm grava a sessão (cookies).
  const confirm = await fetch(
    `${APP_URL}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type}&next=/admin`,
    { redirect: 'manual' }
  )
  const setCookies = confirm.headers.getSetCookie?.() ?? []
  const location = confirm.headers.get('location') ?? ''
  check(
    'callback redireciona para /admin',
    location.includes('/admin') && !location.includes('erro'),
    `→ ${location}`
  )

  const allAuth = setCookies.filter((c) => /auth-token/i.test(c))
  check(
    'sessão gravada (cookie de auth presente)',
    allAuth.length > 0,
    `${allAuth.length} cookie(s)`
  )
  // D-10 / A-10: httpOnly + SameSite=Lax nos cookies de sessão.
  check(
    'D-10: TODOS os cookies de auth são HttpOnly',
    allAuth.length > 0 && allAuth.every((c) => /HttpOnly/i.test(c))
  )
  check(
    'D-10: cookies de auth com SameSite=Lax',
    allAuth.length > 0 && allAuth.every((c) => /SameSite=Lax/i.test(c))
  )

  const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ')

  // 5) Gate: /admin COM sessão → 200 e conteúdo de admin.
  const admin = await fetch(`${APP_URL}/admin`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  })
  const adminBody = admin.status === 200 ? await admin.text() : ''
  check('gate: /admin autenticado responde 200', admin.status === 200, `status=${admin.status}`)
  check(
    'gate: /admin mostra papel admin (requireEditor resolveu)',
    /Painel/.test(adminBody) && /admin/.test(adminBody)
  )

  // 6) Gate negativo: /admin SEM sessão → redirect ao login.
  const noSession = await fetch(`${APP_URL}/admin`, { redirect: 'manual' })
  check(
    'gate: /admin sem sessão → redirect /admin/login',
    (noSession.status === 307 || noSession.status === 302) &&
      (noSession.headers.get('location') ?? '').includes('/admin/login'),
    `status=${noSession.status}`
  )

  // 7) Refresh do proxy sobrevive: 2ª visita a /admin segue 200.
  const admin2 = await fetch(`${APP_URL}/admin`, {
    headers: { cookie: cookieHeader },
    redirect: 'manual',
  })
  check(
    'refresh do proxy: 2ª visita a /admin segue autenticada (200)',
    admin2.status === 200,
    `status=${admin2.status}`
  )

  await cleanup()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
  if (failed.length) {
    console.error('FALHOU:', failed.map((f) => f.name).join(' | '))
    process.exit(1)
  }
}

main().catch(async (e) => {
  console.error('ERRO e2e:', e?.message ?? e)
  try {
    await cleanup()
  } catch {}
  process.exit(1)
})
