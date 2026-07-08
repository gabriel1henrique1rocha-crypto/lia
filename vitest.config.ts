import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest = testes de unidade/componente em src/. Os specs de a11y em tests/
    // rodam no Playwright (navegador real) — não devem ser coletados aqui.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Carrega .env.local (gitignored) em process.env para os testes — usado pelo
    // teste de integração RLS local-only (SUPABASE_LOCAL_* nunca hardcoded).
    env: loadEnv(mode, process.cwd(), ''),
  },
  resolve: {
    alias: {
      '@': '/src',
      // `server-only` real LANÇA fora de ambiente server do Next → aliasado para
      // um stub vazio SÓ no runner de testes, permitindo importar módulos
      // server-only em unit tests. O build de produção usa o pacote real
      // (fronteira SEC-03 intacta). Ver src/test/server-only-stub.ts.
      'server-only': '/src/test/server-only-stub.ts',
    },
  },
}))
