// Stub vazio de `server-only` para o runner de testes (Vitest/jsdom).
//
// O pacote real `server-only` LANÇA ao ser importado fora de um ambiente de
// servidor do Next — é exatamente o seu propósito (quebrar o build se um módulo
// server-only entrar em bundle de cliente, SEC-03/C-3). Mas isso também impede
// importar, em teste unitário, qualquer módulo que faça `import 'server-only'`
// (env.admin.ts, admin.ts, authenticated.ts, requireEditor.ts…).
//
// Este stub é aliasado SOMENTE no runner (vitest.config.ts → resolve.alias).
// O `next build` de produção continua usando o pacote real — a fronteira
// estrutural do SEC-03 NÃO é enfraquecida (a prova de build é a T15/T16).
export {}
