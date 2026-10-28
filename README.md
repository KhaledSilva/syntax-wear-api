# Syntax Wear API

API backend para o e-commerce Syntax Wear, com autenticação, catálogo de produtos e categorias e gerenciamento de pedidos.

## Tecnologias

Node.js, TypeScript, Fastify 5, PostgreSQL, Prisma ORM, Zod, JWT, bcrypt, Google Auth Library, Vitest, Swagger/OpenAPI e Scalar.

## Funcionalidades

- Cadastro e autenticação por e-mail/senha ou credencial Google; sessão JWT em cookie HttpOnly.
- Catálogo com paginação, filtros por preço, busca, categoria, cor, tamanho e estoque, além de ordenação.
- CRUD de categorias e produtos; remoções são feitas por desativação lógica.
- Pedidos associados ao usuário, com validação de disponibilidade, total calculado a partir dos produtos e transições de status controladas.
- Autorização por propriedade do pedido e papel `ADMIN`.

## Estrutura

```text
prisma/       Schema, migrações e seed
src/
  controllers/  Controladores HTTP
  middlewares/  Autenticação, autorização e erros
  routes/       Rotas da API
  services/     Regras de negócio e acesso a dados
  types/        Tipos compartilhados
  utils/        Prisma e validadores
tests/        Testes de rotas e transições de pedidos; docs/ documentação e planejamento
```

## Requisitos e instalação

Requer Node.js, npm e um banco PostgreSQL acessível.

Instale as dependências e crie `.env` na raiz, usando `.env.example` como referência:

```bash
npm ci
```

Exemplo de configuração (substitua os valores de exemplo; não compartilhe credenciais):

```dotenv
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/syntax_wear?schema=public"
JWT_SECRET="substitua-por-um-segredo-forte"
GOOGLE_CLIENT_ID="seu-client-id-do-google"
```

`DATABASE_URL` aponta para o PostgreSQL; `JWT_SECRET` assina os tokens. `PORT` e `HOST` definem onde o servidor escuta (padrões: `3000` e `0.0.0.0`). `NODE_ENV=production` habilita `Secure` no cookie. `GOOGLE_CLIENT_ID` é usado no login Google.

Gere o cliente Prisma e aplique as migrações:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Opcionalmente, carregue os dados de demonstração:

```bash
npm run prisma:seed
```

O seed cria/atualiza categorias e produtos. Também cria/atualiza um pedido para o primeiro usuário existente; cadastre um usuário antes para incluir esse pedido.

## Execução

```bash
npm run dev       # Desenvolvimento, com watch
npm run build     # Compila TypeScript para dist/
npm start         # Executa a versão compilada
```

O servidor inicia por padrão em `http://localhost:3000`. `GET /health` verifica a disponibilidade e `GET /api-docs` abre a documentação interativa.

## Endpoints principais

Produtos e categorias exigem autenticação em todas as rotas; operações de escrita exigem `ADMIN`. Pedidos exigem autenticação e respeitam propriedade, papel e estado.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Informações básicas da API |
| `GET` | `/health` | Verificação de disponibilidade |
| `POST` | `/auth/register` | Cadastro de usuário |
| `POST` | `/auth/login` | Login por e-mail e senha |
| `POST` | `/auth/google` | Login com credencial Google |
| `GET` | `/auth/profile` | Perfil do usuário autenticado |
| `POST` | `/auth/logout` | Encerra sessão removendo o cookie |
| `GET` | `/products` | Lista produtos; suporta paginação e filtros |
| `GET` | `/products/:id` | Consulta produto e categoria |
| `POST` | `/products` | Cria produto (`ADMIN`) |
| `PUT`, `DELETE` | `/products/:id` | Atualiza ou desativa produto (`ADMIN`) |
| `GET` | `/categories` | Lista categorias |
| `GET` | `/categories/:id` | Consulta categoria |
| `POST` | `/categories` | Cria categoria (`ADMIN`) |
| `PUT`, `DELETE` | `/categories/:id` | Atualiza ou desativa categoria (`ADMIN`) |
| `POST` | `/orders` | Cria pedido para o usuário autenticado |
| `GET` | `/orders` | Lista pedidos próprios; `ADMIN` lista todos |
| `GET`, `PUT`, `DELETE` | `/orders/:id` | Consulta, atualiza ou solicita cancelamento |

Para `/products`, filtros disponíveis: `page`, `limit` (máximo 100), `categoryId`, `minPrice`, `maxPrice`, `search`, `color`, `size`, `active`, `inStock`, `sortBy` e `sortOrder`. Pedidos começam em `PENDING`; apenas `ADMIN` pode executar transições operacionais (`CONFIRMED`, `PAID`, `SHIPPED`, `DELIVERED`). Compradores podem cancelar pedidos não pagos. A alteração dos demais dados do pedido só é permitida enquanto pendente. Não há integração de pagamento ou envio implementada.

As rotas autenticadas usam o cookie `syntaxwear.token`, definido no cadastro e login.

## Banco de dados

O schema Prisma define `User`, `Product`, `Category`, `Order` e `OrderItem`. Produtos pertencem a uma categoria; pedidos pertencem a usuários e contêm itens com preço e nome registrados no pedido. Migrações ficam em `prisma/migrations/`.

## Testes

```bash
npm test                 # Testes de transição de status dos pedidos
npm run test:auth         # Rotas de autenticação
npm run test:products     # Rotas de produtos
npm run test:categories   # Rotas de categorias
npm run test:orders       # Rotas de pedidos
```
