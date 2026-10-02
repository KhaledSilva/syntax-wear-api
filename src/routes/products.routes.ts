import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/products.controller";
import { authenticate } from "../middlewares/auth.middleware";

export default async function productsRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Lista os produtos disponíveis",
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", description: "Página dos resultados" },
            limit: {
              type: "string",
              description: "Quantidade de produtos por página",
            },
            minPrice: { type: "string", description: "Preço mínimo" },
            maxPrice: { type: "string", description: "Preço máximo" },
            search: { type: "string", description: "Termo de busca" },
            color: { type: "string", description: "Cor do produto" },
            size: { type: "string", description: "Tamanho do produto" },
            active: { type: "string", description: "Status ativo do produto" },
            inStock: {
              type: "string",
              description: "Disponibilidade em estoque",
            },
            sortBy: { type: "string", description: "Campo de ordenação" },
            sortOrder: { type: "string", description: "Direção da ordenação" },
          },
          additionalProperties: true,
        },
      },
    },
    listProducts,
  );
}
