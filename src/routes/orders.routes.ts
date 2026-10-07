import { FastifyInstance } from "fastify";
import {
  cancelOrder,
  createNewOrder,
  getOrder,
  listOrders,
  updateExistingOrder,
} from "../controllers/orders.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { CreateOrder, UpdateOrder } from "../types";

const orderResponse = {
  type: "object",
  description: "Pedido com itens e dados públicos dos produtos",
  additionalProperties: true,
};

const errorResponses = {
  400: {
    description: "Parâmetros ou corpo da requisição inválidos",
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
    description: "Pedido ou produto não encontrado",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  409: {
    description: "Transição inválida, pedido não pendente ou produto indisponível",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  403: {
    description: "Operação não permitida para este usuário",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
};

export default async function ordersRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateOrder }>(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Orders"],
        description: "Cria um pedido para o usuário autenticado",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["items", "shippingAddress", "paymentMethod"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["productId", "quantity", "size"],
                properties: {
                  productId: { type: "integer", minimum: 1 },
                  quantity: { type: "integer", minimum: 1 },
                  size: { type: "string", minLength: 1, description: "Tamanho do produto" },
                },
              },
            },
            shippingAddress: {
              type: "object",
              additionalProperties: false,
              required: ["cep", "street", "number", "neighborhood", "city", "state", "country"],
              properties: {
                cep: { type: "string" },
                street: { type: "string" },
                number: { type: "string" },
                complement: { type: "string" },
                neighborhood: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
              },
            },
            paymentMethod: { type: "string", minLength: 1 },
          },
        },
        response: {
          201: orderResponse,
          ...errorResponses,
        },
      },
    },
    createNewOrder,
  );

  fastify.put<{
    Params: { id: string };
    Body: UpdateOrder;
  }>(
    "/:id",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Orders"],
        description: "Informe o ID na URL (ex.: /orders/123) e ao menos um campo no JSON; shippingAddress aceita somente campos parciais.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[1-9]\\d*$", description: "ID do pedido" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            status: {
              type: "string",
              enum: ["PENDING", "CONFIRMED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"],
            },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["productId", "quantity", "size"],
                properties: {
                  productId: { type: "integer", minimum: 1 },
                  quantity: { type: "integer", minimum: 1 },
                  size: { type: "string", minLength: 1 },
                },
              },
            },
            shippingAddress: {
              type: "object",
              additionalProperties: false,
              properties: {
                cep: { type: "string" },
                street: { type: "string" },
                number: { type: "string" },
                complement: { type: "string" },
                neighborhood: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
              },
            },
            paymentMethod: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: orderResponse,
          ...errorResponses,
        },
      },
    },
    updateExistingOrder,
  );

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Orders"],
        description: "Pedido cancelado com sucessso",
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
    cancelOrder,
  );

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
