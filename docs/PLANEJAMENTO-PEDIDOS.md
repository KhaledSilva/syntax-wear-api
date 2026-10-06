# Planejamento: CRUD de pedidos

Este documento registra o escopo e as decisões para implementar pedidos na API Syntax Wear. É um planejamento: não representa funcionalidades já implementadas.

## Escopo e decisões

- Todo pedido pertence a um usuário autenticado.
- Cada usuário pode consultar e gerenciar os próprios pedidos. Usuários com papel `ADMIN` podem gerenciar todos os pedidos.
- Nesta primeira versão, criar ou atualizar um pedido não reserva nem reduz o estoque dos produtos.
- O cliente informa os produtos e suas quantidades. O backend consulta os produtos e calcula os valores com base nos preços persistidos; preços enviados pelo cliente não são confiáveis e não devem ser usados.
- O total do pedido é a soma dos itens. O frete fica fora do total até existir uma integração de cálculo.
- Itens, endereço de entrega e método de pagamento podem ser alterados somente enquanto o pedido estiver `PENDING`.
- Pedidos não são apagados fisicamente. O cancelamento é a operação prevista para encerrar um pedido.
- Estados previstos: `PENDING`, `CONFIRMED`, `PAID`, `SHIPPED`, `DELIVERED` e `CANCELLED`.
- O fluxo normal é `PENDING` → `CONFIRMED` → `PAID` → `SHIPPED` → `DELIVERED`. O cancelamento é permitido antes do envio, respeitando as permissões descritas abaixo.
- Depois de pago, somente `ADMIN` pode cancelar o pedido. Eventual estorno será tratado fora da API nesta versão.

## Modelo de dados proposto

Adicionar ao schema Prisma:

- `Order`: pedido associado obrigatoriamente a `User`, com status, endereço de entrega, método de pagamento, total e datas de criação/atualização.
- `OrderItem`: item associado a um pedido e a um produto, com quantidade e preço unitário registrado na criação.
- Um snapshot do nome e do preço do produto no item do pedido preservará o histórico de compra mesmo que os dados do catálogo mudem posteriormente.
- Um enum Prisma representará os estados do pedido.

As relações devem permitir consultar os pedidos de um usuário, os itens de cada pedido e os produtos correspondentes. A introdução desses modelos deverá ser acompanhada de uma migration.

### Andamento

- Etapa 1 — schema e migration: schema Prisma e arquivo de migration criados e migration aplicada ao banco.
- Etapas 2 a 6: não iniciadas.

## API proposta

Prefixo: `/orders`.

| Método | Rota | Finalidade |
| --- | --- | --- |
| `POST` | `/orders` | Criar um pedido para o usuário autenticado. |
| `GET` | `/orders` | Listar os pedidos do usuário autenticado; `ADMIN` pode listar todos. |
| `GET` | `/orders/:id` | Consultar um pedido, respeitando propriedade ou papel `ADMIN`. |
| `PATCH` | `/orders/:id` | Atualizar itens, endereço ou método de pagamento enquanto o pedido estiver `PENDING`. |
| `PATCH` | `/orders/:id/status` | Avançar ou cancelar o pedido conforme as transições e permissões permitidas. |

Não haverá `DELETE /orders/:id`: o pedido será cancelado em vez de removido.

## Etapas de implementação

1. **Schema e migration**
   - Adicionar os modelos `Order` e `OrderItem`, o enum de status e as relações com `User` e `Product`.
   - Registrar nos itens os dados históricos necessários, incluindo nome e preço unitário do produto no momento da compra.
   - Criar e aplicar a migration após confirmar o schema.

2. **Validação e tipos**
   - Criar tipos e schemas Zod para criação, edição e transição de status.
   - Exigir uma lista não vazia de itens e quantidades inteiras positivas.
   - Não aceitar preço definido pelo cliente.
   - Validar a existência e a disponibilidade dos produtos de acordo com as regras acordadas.

3. **Service**
   - Criar pedidos e calcular valores com os preços consultados no banco.
   - Atualizar itens e recalcular o total somente quando o pedido estiver pendente.
   - Implementar listagem e consulta com escopo por usuário.
   - Validar as transições de status e as permissões de cancelamento.
   - Usar transações Prisma nas operações que alterem o pedido e seus itens para manter os dados consistentes.

4. **Autenticação e autorização**
   - Proteger as rotas de pedidos com JWT.
   - Aplicar autorização por propriedade: o usuário acessa apenas os próprios pedidos.
   - Permitir acesso administrativo a todos os pedidos para usuários `ADMIN`.
   - O middleware existente verifica o JWT; a autorização por papel e propriedade precisará ser implementada como regra adicional.

5. **Controller e rotas**
   - Criar `orders.service.ts`, `orders.controller.ts` e `orders.routes.ts`, seguindo a organização existente.
   - Registrar as rotas no Fastify sob o prefixo `/orders`.
   - Definir respostas HTTP e documentação OpenAPI coerentes com os schemas e as permissões.

6. **Testes e documentação**
   - Testar validação de payloads, cálculo do total e edição apenas em pedidos pendentes.
   - Testar isolamento entre usuários e acesso administrativo.
   - Testar transições válidas e inválidas de status, incluindo cancelamento após pagamento.
   - Atualizar `ARQUITETURA.md` quando o recurso for implementado, documentando comportamento e limitações reais.

## Fora do escopo desta versão

- Reserva ou redução automática de estoque ao criar ou atualizar pedidos.
- Cálculo ou cobrança de frete.
- Integração com gateway de pagamento ou processamento de estornos.
- Exclusão física de pedidos.
