# Documentação da API Syntax Wear

Este documento descreve a implementação atual do backend, organizado em Node.js, TypeScript, Fastify e Prisma. O arquivo [PRD-backend.md](./PRD-backend.md) apresenta objetivos e funcionalidades planejadas; nem tudo que está no PRD está implementado no código atual.

## Visão geral

A API do e-commerce Syntax Wear implementa os módulos centrais de catálogo e autenticação, além de criação e consulta autenticadas de pedidos:

- consulta, criação, atualização e desativação lógica de produtos;
- cadastro e autenticação de usuários com senha criptografada e JWT;
- gestão de categorias com slug e ativação lógica;
- listagem e consulta de pedidos com autorização por proprietário ou papel `ADMIN`;
- persistência em PostgreSQL por meio do Prisma;
- documentação OpenAPI servida pelo Scalar.

O fluxo de uma requisição segue a convenção do Fastify:

1. o Fastify recebe a requisição e aplica os plugins e hooks registrados;
2. a rota encaminha para o controller correspondente;
3. o controller valida os dados de entrada com Zod e delega a operação ao service;
4. o service aplica regras de negócio e persiste/consulta dados com Prisma;
5. o controller monta a resposta HTTP;
6. erros não tratados são enviados para o error handler global.

## Estrutura principal

| Caminho | Responsabilidade |
| --- | --- |
| `src/app.ts` | Configura o Fastify, registra plugins, rotas e endpoints de saúde, além do error handler global. |
| `src/routes/products.routes.ts` | Declara os endpoints de produtos, documentação OpenAPI e parâmetros de filtro. |
| `src/routes/categories.routes.ts` | Declara os endpoints de categorias com CRUD e documentação de respostas. |
| `src/routes/auth.routes.ts` | Declara `register` e `login` da API. |
| `src/routes/orders.routes.ts` | Declara listagem e busca autenticadas de pedidos. |
| `src/controllers/products.controller.ts` | Valida dados de entrada dos produtos, prepara slug, chama services e define respostas HTTP. |
| `src/controllers/categories.controller.ts` | Encapsula validação e execução do CRUD de categoria. |
| `src/controllers/auth.controller.ts` | Valida cadastro e login, gera token JWT e formata resposta. |
| `src/controllers/orders.controller.ts` | Obtém a identidade do token, valida o ID e prepara respostas de pedidos. |
| `src/services/products.service.ts` | Implementa listagem, filtros, paginação, criação, atualização e desativação lógica de produtos. |
| `src/services/categories.service.ts` | Implementa consulta, criação, atualização e desativação lógica de categorias. |
| `src/services/auth.service.ts` | Cria usuários, verifica email e senha e usa `bcrypt` para hash/verificação. |
| `src/services/orders.service.ts` | Lista e consulta pedidos com escopo por usuário e dados dos itens/produtos. |
| `src/utils/validators.ts` | Define schemas Zod para autenticação, categorias, produtos e filtros. |
| `src/types/index.ts` | Define tipos TypeScript compartilhados para produtos, categorias, filtros e autenticação. |
| `src/utils/prisma.ts` | Cria e exporta o cliente Prisma com o datasource do PostgreSQL. |
| `src/middlewares/auth.middleware.ts` | Verifica o JWT recebido na requisição. |
| `src/middlewares/error.middleware.ts` | Converte erros de validação e erros não tratados em respostas HTTP. |
| `prisma/schema.prisma` | Define os modelos e enums persistidos no banco. |
| `prisma/migrations/` | Guarda o histórico de evolução do schema. |
| `prisma/seed.ts` | Insere ou atualiza produtos de exemplo usando `upsert` pelo slug. |
| `prisma.config.ts` | Configura schema, migrations e datasource do Prisma. |
| `.env.example` | Lista as variáveis esperadas pela aplicação. |
| `docs/PRD-backend.md` | Documenta o produto, requisitos previstos e extensão do projeto. |

## Produtos: CRUD, filtros e categoria

As rotas de produtos ficam no prefixo `/products` em `src/app.ts`.

| Método | Caminho | Finalidade | Comportamento de sucesso |
| --- | --- | --- | --- |
| `GET` | `/products` | Lista produtos com filtros e paginação. | `200` com a lista. |
| `GET` | `/products/:id` | Busca um produto pelo ID. | `200` com o produto e categoria associada. |
| `POST` | `/products` | Cria um produto. | `201` com mensagem de sucesso. |
| `PUT` | `/products/:id` | Atualiza os campos enviados. | `200` com o produto atualizado. |
| `DELETE` | `/products/:id` | Desativa o produto. | `200` com mensagem de sucesso. |

### Fluxo de criação

1. `createNewProduct` gera o slug a partir do nome com `slugify` (`lower: true`, `strict: true`, locale `pt`).
2. `createProductSchema` valida os campos, incluindo `categoryId`.
3. `createProduct` verifica se o slug já existe e cria o registro.
4. O controller responde com status `201`.

### Fluxo de atualização

1. `updateExistingProduct` valida o body com `updateProductSchema`.
2. Se `name` foi informado, recalcula o slug.
3. `updateProduct` verifica se o produto existe e se o slug não pertence a outro registro.
4. O registro é atualizado e retornado.

### Fluxo de exclusão

A exclusão é lógica: `deleteProduct` localiza o registro e define `active: false`. O registro continua no banco e não é apagado fisicamente. A listagem sem filtro pode continuar incluindo esse item; para filtrar somente ativos, use `active=true`.

### Filtros de listagem

`productFiltersSchema` valida e converte os parâmetros de query:

| Parâmetro | Uso |
| --- | --- |
| `page` | Página, inteiro a partir de 1; padrão `1`. |
| `limit` | Itens por página, de 1 a 100; padrão `20`. |
| `minPrice`, `maxPrice` | Limites inclusivos de preço. |
| `search` | Busca sem distinção entre maiúsculas/minúsculas em nome, descrição ou slug. |
| `color` | Filtra por uma cor contida no array `colors`. |
| `size` | Filtra por um tamanho contido no JSON `sizes`. |
| `active` | Filtra pelo estado ativo (`true`/`false`). |
| `inStock` | `true` exige estoque maior que zero; `false` considera estoque zero ou negativo. |
| `sortBy` | Ordenação por `price`, `name` ou `createdAt`. |
| `sortOrder` | Direção `asc` ou `desc`; padrão `desc`. |

A paginação é aplicada no service com `skip` e `take`, com validação adicional de limites.

## Categorias: CRUD e relacionamento

O módulo de categorias já foi implementado e está acessível no prefixo `/categories`.

| Método | Caminho | Finalidade | Comportamento de sucesso |
| --- | --- | --- | --- |
| `GET` | `/categories` | Lista todas as categorias ativas e ordenadas por nome. | `200` com a lista. |
| `GET` | `/categories/:id` | Busca uma categoria pelo ID. | `200` com a categoria. |
| `POST` | `/categories` | Cria uma nova categoria. | `201` com mensagem de sucesso. |
| `PUT` | `/categories/:id` | Atualiza os campos enviados. | `200` com a categoria atualizada. |
| `DELETE` | `/categories/:id` | Desativa a categoria. | `200` com mensagem de sucesso. |

A criação e atualização também geram `slug` com `slugify` e validam unicidade do valor. A exclusão segue o mesmo padrão do produto: `active: false` em vez de remoção física.

## Autenticação

As rotas de autenticação são registradas com prefixo `/auth`.

| Método | Caminho | Finalidade |
| --- | --- | --- |
| `POST` | `/auth/register` | Cadastra um usuário e retorna usuário + JWT. |
| `POST` | `/auth/login` | Verifica email/senha e retorna usuário + JWT. |

No cadastro, o service verifica se o email já existe, aplica `bcrypt.hash` com fator `10` e persiste o usuário com papel `USER`. No login, compara a senha informada com o hash usando `bcrypt.compare`. O controller emite um token pelo plugin `@fastify/jwt`, contendo `userId`.

O middleware `authenticate` chama `request.jwtVerify()`. Se a verificação falhar, responde `401`.

## Pedidos: criação e consulta autenticadas

As rotas de pedidos usam o prefixo `/orders` e exigem um JWT válido:

| Método | Caminho | Finalidade | Comportamento |
| --- | --- | --- | --- |
| `POST` | `/orders` | Cria um pedido. | O pedido pertence ao usuário autenticado, inicia como `PENDING` e retorna `201`. |
| `GET` | `/orders` | Lista pedidos. | Usuários recebem somente os próprios pedidos; `ADMIN` recebe todos. Os resultados vêm do mais recente para o mais antigo. |
| `GET` | `/orders/:id` | Busca um pedido pelo ID. | O proprietário ou `ADMIN` recebe o pedido; pedido inexistente ou sem acesso retorna `404`. |
| `PUT` | `/orders/:id` | Atualiza dados ou estado do pedido. | Aceita qualquer combinação de `status`, `items`, `shippingAddress` e `paymentMethod`; dados editáveis só mudam em `PENDING` e status segue as transições permitidas. |
| `DELETE` | `/orders/:id` | Cancela o pedido. | Não remove registros; segue as mesmas permissões e transições de cancelamento do fluxo de status e retorna o pedido com status `CANCELLED`. |

O corpo de criação exige `items` (lista não vazia de `productId`, `quantity` e `size`), `shippingAddress` (CEP, rua, número, bairro, cidade, estado e país; complemento opcional) e `paymentMethod`. Campos extras, incluindo preços fornecidos pelo cliente, são rejeitados. Produtos inexistentes retornam `404`; produtos inativos, com tamanho indisponível ou com estoque menor que a quantidade solicitada retornam `409`.

A criação e a atualização consultam os produtos no banco, verificam o tamanho selecionado, calculam o total usando os preços persistidos e guardam snapshots de nome e preço unitário, além do tamanho escolhido, nos itens. Cada operação grava o pedido e seus itens em uma transação. A criação inicia o pedido como `PENDING`. O `PUT` aceita qualquer combinação não vazia entre `status`, `items`, `shippingAddress` e `paymentMethod`; cada campo omitido permanece inalterado. O objeto `shippingAddress` também é parcial: por exemplo, pode-se enviar somente `number` ou `complement`, e os demais campos do endereço existente são preservados. Itens, endereço e pagamento só podem mudar enquanto o estado atual for `PENDING`; a lista de itens, quando enviada, substitui os itens e recalcula o total. As transições permitidas são `PENDING` → `CONFIRMED` ou `CANCELLED`, `CONFIRMED` → `PAID` ou `CANCELLED`, `PAID` → `SHIPPED` ou `CANCELLED` e `SHIPPED` → `DELIVERED`. Cancelar após pagamento só é permitido a `ADMIN`, e não há cancelamento após envio. O frete não está incluído e o estoque é validado, mas não é reservado nem reduzido. A coluna `OrderItem.size` é opcional para manter compatibilidade com itens antigos; pedidos novos e atualizados persistem o tamanho selecionado. As respostas incluem os itens e dados públicos selecionados do produto (`id`, `name`, `slug` e `images`). Tokens emitidos no login e cadastro carregam o papel do usuário, e tokens anteriores sem essa informação continuam limitados ao acesso de usuário comum.

Exemplos de atualização: `PUT /orders/123` com `{ "status": "PAID" }` altera somente o status, e `{ "shippingAddress": { "number": "42" } }` altera somente o número. No `PUT`, todas as propriedades de `shippingAddress` são opcionais, inclusive é permitido enviar `{ "shippingAddress": {} }` sem modificar o endereço. `DELETE /orders/123` solicita cancelamento lógico, não exclusão física. O `id` precisa estar na URL como parte do caminho; não basta chamar a rota sem o identificador. Toda requisição precisa incluir JWT válido.

## Modelo de dados Prisma

O datasource é PostgreSQL. Os modelos atuais são:

### `User`

- `id`: identificador inteiro autoincremental.
- `firstName`, `lastName`, `email`, `password`: dados da conta; email é único.
- `cpf`: opcional e único quando preenchido.
- `phone`, `birthDate`: opcionais.
- `createdAt`: data de criação.
- `role`: enum `USER` ou `ADMIN`, padrão `USER`.

### `Category`

- `id`: identificador inteiro autoincremental.
- `name`: nome da categoria.
- `slug`: slug único e indexado.
- `description`: texto opcional.
- `active`: booleano, padrão `true`.
- `createdAt`: timestamp de criação.
- `updatedAt`: timestamp de atualização automática pelo Prisma.
- `products`: relação com os produtos vinculados à categoria.

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
- `updatedAt`: data de atualização automática pelo Prisma.
- `category`: relacionamento obrigatório com `Category`.
- `categoryId`: chave estrangeira da categoria do produto.

### `Order` e `OrderItem`

- `Order` pertence a um usuário e contém total, status, endereço de entrega, método de pagamento e datas de criação/atualização.
- `OrderItem` pertence a um pedido e a um produto, guardando quantidade, tamanho escolhido e snapshot de nome e preço unitário.
- Os estados possíveis são `PENDING`, `CONFIRMED`, `PAID`, `SHIPPED`, `DELIVERED` e `CANCELLED`.
- As rotas de consulta carregam os itens e uma seleção não sensível dos dados atuais do produto relacionado.

As migrations registram a criação das tabelas, a inclusão de `colors` em produtos, a criação de `Category` e o vínculo entre `Product` e `Category`. O schema é a referência declarativa atual; as migrations continuam registrando a evolução do banco.

## Validação e tipos

Os schemas Zod em `src/utils/validators.ts` definem validação de:

- email e tamanho mínimo de senha para login/cadastro;
- campos obrigatórios e formatos básicos dos dados de usuário;
- criação e atualização de produto e categoria;
- filtros de listagem, incluindo conversão de query strings para números e booleanos;
- ID usado na exclusão de produto e categoria.

`src/types/index.ts` define tipos de compile-time, como `CreateProduct`, `ProductFilters`, `AuthRequest` e `RegisterRequest`. Esses tipos ajudam o TypeScript, mas não substituem a validação em runtime do Zod.

## Configuração, inicialização e comandos

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e configure os valores reais:
   - `DATABASE_URL`: conexão PostgreSQL;
   - `JWT_SECRET`: segredo usado para assinar e verificar JWT;
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
| `npm run start` | Executa o build em ambiente de produção. |
| `npm run prisma:generate` | Gera o cliente Prisma. |
| `npm run prisma:migrate` | Executa `prisma migrate dev`. |
| `npm run prisma:studio` | Abre o Prisma Studio. |
| `npm run prisma:seed` | Executa o seed de produtos. |

O endereço de documentação OpenAPI/Scalar é `/api-docs`. Também existem `GET /` (informações básicas da API) e `GET /health` (estado e timestamp).

## Comportamentos e pontos de atenção observados

- Os hooks de autenticação de `products` e `categories` estão comentados no momento. Isso significa que, na prática, as rotas de catalogo e categorias ainda estão livres para uso público, a menos que o hook seja reativado manualmente.
- A autenticação própria existe em `src/middlewares/auth.middleware.ts`; a proteção é aplicada individualmente nas rotas que a exigem.
- As rotas de pedidos são protegidas; leitura, edição e transições de status aplicam autorização por proprietário ou `ADMIN`, e a criação vincula o pedido ao usuário do token.
- A exclusão de produtos e categorias é lógica (`active: false`), não física. A listagem sem filtro pode continuar retornando registros inativos.
- O service de autenticação retorna o objeto do usuário completo, incluindo `password` em hash. Esse dado deve ser removido da resposta antes de expor a API em produção.
- O error handler trata erros de validação em `400`, mas erros de domínio ainda retornam mensagens técnicas e não um mapeamento formal de `404`/`409` para cenários como usuário inexistente, produto não encontrado ou email duplicado.
- O campo `price` é persistido como `Decimal` do Prisma, enquanto os schemas de rota e os tipos TypeScript normalmente tratam o valor como `number`. O cliente e o backend devem convergir na serialização/normalização desse valor.
- `npm run start` ainda deve ser alinhado com o entrypoint compilado correto (`dist/app.js`), porque o projeto atual não possui `src/server.ts` e o build gera saída sob `dist/`.
- O PRD ainda prevê módulos como criação e gestão completa de pedidos, checkout, frete, perfil do usuário, upload de imagens e área administrativa. Esses recursos continuam como extensão do escopo atual, e não como partes já entregues.

## Escopo atual e extensões previstas

O backend implementado até agora cobre produtos, categorias e autenticação básica. O catálogo já está funcional como base da loja, com relacionamento entre produtos e categorias e filtros de listagem, enquanto a camada de autenticação fornece login e registro com JWT.

Continuam fora do escopo entregue: checkout, cálculo de frete, newsletter, upload de imagens, perfil do usuário e rotas administrativas. A autorização por papel está implementada nas consultas e operações de pedido disponíveis. Consulte o [PRD-backend.md](./PRD-backend.md) para os requisitos planejados e para a roadmap de evolução da API.
