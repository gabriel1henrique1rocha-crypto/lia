import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

// Mensagem da fronteira de import do admin (SEC-03/C-3, design §1.3).
const ADMIN_BOUNDARY_MSG =
  'Import PROIBIDO: o client service_role é DORMENTE (C-2). A allowlist nasce VAZIA — ' +
  'nenhum arquivo da app pode importar o admin. Uma exceção real exige, deliberadamente: ' +
  'ADR + GRANT explícito de tabela para service_role + edição desta regra (diff revisável).'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Fronteira ESTRUTURAL de import do admin (3ª camada, além de `server-only` e
  // da env sem NEXT_PUBLIC): SEC-03/SEC-15b/C-2. Allowlist VAZIA — proíbe
  // `@/lib/supabase/admin` (o client) e `@/lib/env.admin` (a env secreta) em
  // TODO o src/. `server-only` barra bundle de cliente; esta regra barra também
  // um Server Component público de importar o admin e rodar bypass no servidor
  // (modo F-2 do threat model).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@/lib/supabase/admin', message: ADMIN_BOUNDARY_MSG },
            { name: '@/lib/env.admin', message: ADMIN_BOUNDARY_MSG },
          ],
        },
      ],
    },
  },
  // ÚNICA exceção estrutural: admin.ts É a fronteira do admin e precisa ler a
  // env secreta (env.admin). Não é um consumidor da app — a dormência ("nenhum
  // arquivo da app importa o admin") permanece verdadeira. Aqui só o client
  // admin segue proibido (auto-import não faz sentido); env.admin é liberada.
  {
    files: ['src/lib/supabase/admin.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@/lib/supabase/admin', message: ADMIN_BOUNDARY_MSG }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Artefatos de referência de design (não são código da aplicação)
    'docs/**',
    // Arquivos de skill do Claude Code (não são código da aplicação)
    '.claude/**',
  ]),
])

export default eslintConfig
