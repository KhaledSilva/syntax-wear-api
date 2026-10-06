import { FastifyInstance } from "fastify";
import {
  createNewCategory,
  deleteExistingCategory,
  getCategories,
  getCategoryById,
  updateExistingCategory,
} from "../controllers/categories.controller";
import { authenticate } from "../middlewares/auth.middleware";

const categoryResponseProperties = {
  id: { type: "integer" },
  name: { type: "string" },
  slug: { type: "string" },
  description: { type: "string", nullable: true },
  active: { type: "boolean" },
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
};

const errorResponses = {
  400: {
    description: "Requisição inválida",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  401: {
    description: "Não autorizado",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  404: {
    description: "Categoria não encontrada",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  500: {
    description: "Erro interno do servidor",
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
};

export default async function categoriesRoutes(fastify: FastifyInstance) {
  // fastify.addHook("onRequest", authenticate);

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Categories"],
        description: "Lista as categorias disponíveis",
        response: {
          200: {
            description: "Lista de categorias",
            type: "array",
            items: {
              type: "object",
              properties: categoryResponseProperties,
            },
          },
          ...errorResponses,
        },
      },
    },
    getCategories,
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description: "Obtém uma categoria pelo ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "number", description: "ID da categoria" },
          },
          required: ["id"],
        },
        response: {
          200: {
            description: "Categoria encontrada",
            type: "object",
            properties: categoryResponseProperties,
          },
          ...errorResponses,
        },
      },
    },
    getCategoryById,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Categories"],
        description: "Criar uma nova categoria",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "Nome da categoria"
            },
            description: {
              type: "string",
              description: "Descrição da categoria (opcional)",
            },
            active: {
              type: "boolean",
              description: "Categoria ativa",
              default: true
            },
          },
        },
        response: {
          201: {
            description: "Categoria criada com sucesso",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          ...errorResponses,
        },
      },
    },
    createNewCategory,
  );

  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description: "Atualizar uma categoria existente",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID da categoria" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", nullable: true },
            active: { type: "boolean" },
          },
        },
        response: {
          200: {
            description: "Categoria atualizada com sucesso",
            type: "object",
            properties: categoryResponseProperties,
          },
          ...errorResponses,
        },
      },
    },
    updateExistingCategory,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description: "Desativar uma categoria pelo ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID da categoria" },
          },
          required: ["id"],
        },
        response: {
          200: {
            description: "Categoria desativada com sucesso",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          ...errorResponses,
        },
      },
    },
    deleteExistingCategory,
  );
}
