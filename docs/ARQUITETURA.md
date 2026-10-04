# Documentação da API Syntax Wear

Este documento descreve a implementação atual do backend, organizado em Node.js, TypeScript, Fastify e Prisma. O arquivo [PRD-backend.md](./PRD-backend.md) apresenta objetivos e funcionalidades planejadas; nem tudo que está no PRD está implementado no código atual.

## Visão geral

A API atende o e-commerce Syntax Wear e atualmente implementa:

- consulta, criação, atualização e desativação de produtos;
- cadastro e login de usuários com senha criptografada e token JWT;
- persistência em PostgreSQL por meio do Prisma;
- documentação OpenAPI servida pelo Scalar.

O fluxo de uma requisição é, em geral:

1. O Fastify recebe a requisição e aplica os hooks/plugins registrados.
2. As rotas encaminham a requisição para um controller.
3. O controller valida os dados de entrada com Zod e chama um service.
4. O service aplica as regras de negócio e consulta ou altera os dados via Prisma.
5. O controller monta a resposta HTTP.
6. Erros não tratados são encaminhados ao error handler global.

## Estrutura principal

| Caminho | Responsabilidade |
| --- | --- |
| `src/app.ts` | Configura e inicia o Fastify, registra plugins e rotas e define os endpoints de status e o error handler. |
| `src/routes/products.routes.ts` | Declara os endpoints de produtos, schemas usados na documentação e hook de autenticação do grupo. |
| `src/routes/auth.routes.ts` | Declara cadastro e login. |
| `src/controllers/products.controller.ts` | Valida dados recebidos, prepara slug, chama os services de produto e define as respostas HTTP. |
| `src/controllers/auth.controller.ts` | Valida cadastro/login, chama os services de autenticação e emite tokens JWT. |
| `src/services/products.service.ts` | Contém consultas, filtros, paginação e regras de criação, atualização e desativação de produtos. |
| `src/services/auth.service.ts` | Cria usuários, verifica email e senha e usa bcrypt para armazenar/verificar senhas. |
| `src/utils/validators.ts` | Define schemas Zod para autenticação, produtos e filtros. |
| `src/types/index.ts` | Define tipos TypeScript compartilhados para produtos, filtros e autenticação. |
| `src/utils/prisma.ts` | Cria e exporta o Prisma Client com o adaptador PostgreSQL. |
| `src/middlewares/auth.middleware.ts` | Verifica o JWT recebido na requisição. |
| `src/middlewares/error.middleware.ts` | Converte erros de validação e erros não tratados em respostas HTTP. |
| `prisma/schema.prisma` | Define os modelos e tipos persistidos no banco. |
| `prisma/migrations/` | Guarda o histórico de alterações do schema do banco. |
| `prisma/seed.ts` | Insere ou atualiza produtos de exemplo usando `upsert` pelo slug. |
| `prisma.config.ts` | Configura o caminho do schema, das migrations e a URL do datasource para o Prisma. |
| `.env.example` | Lista as variáveis de ambiente esperadas como referência. |
| `docs/PRD-backend.md` | Registra a visão de produto e funcionalidades planejadas. |

## Produtos: CRUD e comportamento

As rotas são registradas com o prefixo `/products` em `src/app.ts`.

| Método | Caminho | Finalidade | Comportamento de sucesso |
| --- | --- | --- | --- |
| `GET` | `/products` | Lista produtos; aceita filtros e paginação. | `200` com a lista. |
| `GET` | `/products/:id` | Busca um produto pelo ID. | `200` com o produto. |
| `POST` | `/products` | Cria um produto. | `201` com mensagem de sucesso. |
| `PUT` | `/products/:id` | Atualiza os campos enviados. | `200` com o produto atualizado. |
| `DELETE` | `/products/:id` | Desativa o produto. | `200` com mensagem de sucesso. |

### Fluxo de criação

1. `createNewProduct` gera o slug a partir do nome com `slugify` (minúsculas, formato estrito e locale `pt`).
2. `createProductSchema` valida os campos.
3. `createProduct` verifica se o slug já existe e cria o registro.
4. O controller responde com status `201`.

### Fluxo de atualização

1. `updateExistingProduct` valida o body com `updateProductSchema`.
2. Se o nome foi informado, recalcula o slug.
3. `updateProduct` verifica se o produto existe e se o slug não pertence a outro produto.
4. O registro é atualizado e retornado.

### Fluxo de exclusão

Apesar do verbo HTTP `DELETE`, a implementação é uma exclusão lógica: `deleteProduct` localiza o registro e define `active: false`. O registro continua no banco e não é apagado fisicamente. A listagem não exclui automaticamente produtos inativos; use o filtro `active=true` para limitar os resultados aos ativos.

### Filtros de listagem

`productFiltersSchema` valida e converte os parâmetros de query:

| Parâmetro | Uso |
| --- | --- |
| `page` | Página, inteiro a partir de 1; padrão `1`. |
| `limit` | Itens por página, de 1 a 100; padrão `20`. |
| `minPrice`, `maxPrice` | Limites inclusivos de preço; o mínimo não pode superar o máximo. |
| `search` | Busca sem distinção entre maiúsculas/minúsculas em nome, descrição ou slug. |
| `color` | Filtra por uma cor contida no array `colors`. |
| `size` | Filtra por um tamanho contido no JSON `sizes`. |
| `active` | Filtra pelo estado ativo, com `true` ou `false`. |
| `inStock` | `true` exige estoque maior que zero; `false` considera estoque zero ou negativo. |
| `sortBy` | Ordenação por `price`, `name` ou `createdAt`. |
| `sortOrder` | Direção `asc` ou `desc`; padrão `desc`. |

A paginação é aplicada no service com `skip` e `take`. Os valores de página e limite também são limitados no service como proteção adicional.

## Autenticação

As rotas de autenticação são registradas com o prefixo `/auth`.

| Método | Caminho | Finalidade |
| --- | --- | --- |
| `POST` | `/auth/register` | Cadastra um usuário e retorna usuário e JWT. |
| `POST` | `/auth/login` | Verifica email/senha e retorna usuário e JWT. |

No cadastro, o service verifica se o email já existe, aplica `bcrypt.hash` com fator `10` e persiste o usuário com papel `USER`. No login, compara a senha informada com o hash usando `bcrypt.compare`. O controller emite um token pelo plugin `@fastify/jwt`, contendo `userId`.

O middleware `authenticate` chama `request.jwtVerify()`. Se a verificação falhar, responde `401`.

## Modelo de dados Prisma

O datasource é PostgreSQL. Os modelos atuais são:

### `Product`

- `id`: identificador inteiro autoincremental.
- `name`, `slug`: nome e slug único.
- `description`: texto opcional.
- `price`: `Decimal`.
- `images`, `sizes`: campos JSON opcionais.
- `colors`: array PostgreSQL de texto.
- `stock`: inteiro, padrão `0`.
- `active`: booleano, padrão `true`.
- `createdAt`: data de criação.
- `updatedAt`: data atualizado automaticamente pelo Prisma.

### `User`

- `id`: identificador inteiro autoincremental.
- `firstName`, `lastName`, `email`, `password`: dados da conta; email é único.
- `cpf`: opcional e único quando preenchido.
- `phone`, `birthDate`: opcionais.
- `createdAt`: data de criação.
- `role`: enum `USER` ou `ADMIN`, padrão `USER`.

As migrations registram a criação das tabelas, a inclusão de `colors` em produtos e a inclusão do papel do usuário. O schema é a referência declarativa atual; migrations registram sua evolução no banco.

## Validação e tipos

Os schemas Zod em `src/utils/validators.ts` definem validação de:

- email e tamanho mínimo de senha para login/cadastro;
- campos obrigatórios e formatos básicos dos dados de usuário;
- criação e atualização de produto;
- filtros de listagem, incluindo conversão de query strings para números e booleanos;
- ID usado na exclusão de produto.

`src/types/index.ts` define tipos de compile-time, como `CreateProduct`, `ProductFilters`, `AuthRequest` e `RegisterRequest`. Esses tipos ajudam o TypeScript, mas não substituem a validação em runtime do Zod.

## Configuração, inicialização e comandos

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e configure os valores reais:
   - `DATABASE_URL`: conexão PostgreSQL;
   - `JWT_SECRET`: segredo usado para assinar/verificar JWT;
   - `PORT`: porta HTTP (padrão `3000` no código).
3. Gere o Prisma Client com `npm run prisma:generate`.
4. Aplique migrations no banco de desenvolvimento com `npm run prisma:migrate`.
5. Opcionalmente, carregue os produtos de exemplo com `npm run prisma:seed`.
6. Inicie em desenvolvimento com `npm run dev`.

Comandos disponíveis em `package.json`:

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Executa `src/app.ts` com `tsx watch`. |
| `npm run build` | Compila TypeScript para `dist/`. |
| `npm run start` | Executa `node dist/server.js`. |
| `npm run prisma:generate` | Gera o cliente Prisma. |
| `npm run prisma:migrate` | Executa `prisma migrate dev`. |
| `npm run prisma:studio` | Abre o Prisma Studio. |
| `npm run prisma:seed` | Executa o seed de produtos. |

O endereço de documentação OpenAPI/Scalar é `/api-docs`. Também existem `GET /` (informações básicas da API) e `GET /health` (estado e timestamp).

## Comportamentos e pontos de atenção observados

- O hook `onRequest` de autenticação está registrado no plugin de rotas de produtos, então atualmente **todas** as rotas `/products` exigem JWT, inclusive consultas. A autenticação só verifica a validade do token; não há autorização por papel `ADMIN` nas rotas.
- A documentação OpenAPI declara `security` na rota `PUT`, mas o hook acima protege todo o grupo. Portanto, a documentação interativa não representa completamente a proteção efetiva das rotas.
- O `DELETE` desativa o produto, mas a resposta o descreve como removido. Não é uma remoção física, e a listagem sem filtro pode continuar incluindo esse registro.
- O service de autenticação retorna o registro completo do usuário, e os controllers o incluem na resposta. Como o modelo contém o campo `password` (hash bcrypt), esse campo pode ser enviado ao cliente; revise a projeção dos dados retornados antes de expor o endpoint em produção.
- O error handler trata validações como `400`, mas os outros erros não tratados viram `500` e incluem `error.message` em `debug`. Isso inclui casos como usuário/produto inexistente e email duplicado, que atualmente não têm mapeamento dedicado para `404`/`409`; a mensagem técnica também é enviada ao cliente.
- O schema do produto armazena `price` como Prisma `Decimal`, enquanto tipos/schemas de rota descrevem o preço como número. Confirme a serialização esperada pelo cliente ao integrar a API.
- `npm run start` aponta para `dist/server.js`, mas o `tsconfig.json` compila `src/` para `dist/` e não há `src/server.ts` no código atual. O entrypoint compilado de `src/app.ts` é `dist/app.js`; o comando de produção deve ser alinhado a um entrypoint existente.
- O PRD cita categorias, pedidos, frete, newsletter, upload de imagens e rotas administrativas. Esses recursos não aparecem implementados nas rotas e modelos atuais.

## Escopo atual e extensões previstas

Os arquivos de rota atuais cobrem produtos e autenticação. Não há implementação atual de categorias, checkout/pedidos, cálculo de frete, newsletter, upload de imagens ou endpoints de perfil do usuário. Consulte o [PRD-backend.md](./PRD-backend.md) para as ideias e requisitos planejados, sem assumir que seus endpoints já estão disponíveis.
