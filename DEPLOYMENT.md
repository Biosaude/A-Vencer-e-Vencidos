# Persistência central — Supabase e Vercel

## Por que a versão anterior não funcionava no Vercel

`server.mjs` gravava todo o dataset e os links em `DATA_DIR/shared-dashboard.json`. Além de a tela
administrativa partir do `localStorage`, o filesystem de uma Function do Vercel é efêmero e não é
compartilhado de forma confiável entre invocações. Portanto, ele não podia ser a fonte permanente.

Agora, as Functions em `api/[...path].mjs` são stateless. O PostgreSQL do Supabase é a fonte central;
o `localStorage` é somente uma compatibilidade/cache administrativo e nunca é consultado por `/share/:token`.

## Configuração manual do Supabase

1. Crie ou escolha um projeto Supabase.
2. No **SQL Editor**, execute integralmente
   `supabase/migrations/202609040001_central_persistence.sql`.
3. Em **Project Settings > API**, copie a Project URL e a chave `service_role`.
4. Não crie policies públicas: a migration ativa RLS e deixa as tabelas inacessíveis para `anon` e
   `authenticated`. Somente a Function, usando `service_role`, acessa os dados.

## Variáveis do projeto Vercel `avvgr1`

Cadastre, separadamente em **Production**, **Preview** e **Development**:

| variável | origem |
|---|---|
| `SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > service_role (somente servidor) |
| `DASHBOARD_ADMIN_TOKEN` | segredo longo e aleatório criado pelo administrador |

Use preferencialmente projetos Supabase separados para Production e Preview/Development. Não é
necessária `SUPABASE_ANON_KEY`, pois o navegador nunca acessa o banco. Nenhuma variável deve começar
com `VITE_`. Após cadastrar as variáveis, faça novo deploy da branch `main`.

## Operação e migração

Não há migração automática do navegador. Depois do deploy, o administrador informa o token
administrativo e faz uma última importação de cada origem. Cada arquivo é validado no navegador e a
Function chama uma única transação PostgreSQL. A transação insere a nova versão antes de desativar a
anterior e troca apenas a origem importada. Falhas dão rollback integral.

Links novos armazenam somente SHA-256 do token. O token em texto aparece apenas na resposta de criação;
por isso links antigos não podem ser recuperados pela listagem e devem ser guardados pelo administrador.
Ao abrir `/share/:token`, a Function valida hash, atividade e expiração, aplica o escopo no servidor e
consulta sempre os lotes ativos atuais. A página repete a consulta a cada 45 segundos e ao recuperar foco.
