import { FastifyInstance } from "fastify";
import { getOrder, listOrders } from "../controllers/orders.controller";
import { authenticate } from "../middlewares/auth.middleware";

const orderResponse = {
  type: "object",
  description: "Pedido com itens e dados públicos dos produtos",
  additionalProperties: true,
};

const errorResponses = {
  400: {
    description: "ID inválido",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  401: {
    description: "Token inválido ou expirado",
    type: "object",
    properties: {
      error: { type: "string" },
    },
  },
  404: {
    description: "Pedido não encontrado",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
};

export default async function ordersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Orders"],
        description: "Lista os pedidos do usuário autenticado; ADMIN lista todos",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "Pedidos ordenados do mais recente para o mais antigo",
            type: "array",
            items: orderResponse,
          },
          ...errorResponses,
        },
      },
    },
    listOrders,
  );

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Orders"],
        description: "Busca um pedido por ID, respeitando propriedade ou papel ADMIN",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[1-9]\\d*$", description: "ID do pedido" },
          },
          required: ["id"],
        },
        response: {
          200: orderResponse,
          ...errorResponses,
        },
      },
    },
    getOrder,
  );
}
