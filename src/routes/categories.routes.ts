import { FastifyInstance } from "fastify";
import {
  getCategories,
  getCategoryById,
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
}
