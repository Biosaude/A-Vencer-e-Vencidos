# Persistência e compartilhamento

O build continua sendo gerado pelo Vite, mas a implantação com compartilhamento deve executar
`npm run build` e depois `npm start`. O processo Node serve o conteúdo de `dist/` e a API.

Configure no ambiente do servidor:

- `DASHBOARD_ADMIN_TOKEN`: segredo longo usado apenas para sincronizar bases e administrar links;
- `DATA_DIR`: volume **persistente e compartilhado** montado no servidor (por padrão, `./data`);
- `PORT`: porta HTTP (por padrão, `4173`).

> Não use armazenamento efêmero de funções serverless para `DATA_DIR`. Em plataformas serverless,
> monte um volume persistente ou adapte as funções de `load`/`save` de `server.mjs` para o banco já
> contratado. A API e o cliente não dependem do `localStorage` para consultas compartilhadas.

Na primeira abertura do modal **Compartilhar**, informe `DASHBOARD_ADMIN_TOKEN`. O valor fica apenas
na sessão da aba e é enviado no cabeçalho de administração; ele não é incluído no bundle nem nos links.
Cada criação sincroniza a base local atual antes de emitir um token aleatório de 256 bits. Importações
seguintes sincronizam automaticamente durante a mesma sessão administrativa.

Os links consultam `GET /api/share/:token` a cada 45 segundos e quando a janela volta ao foco. Essa rota
é somente leitura e retorna uma projeção sem conteúdo original importado, contatos, histórico ou campos
administrativos. Revogar ou expirar um link impede imediatamente novas leituras.
