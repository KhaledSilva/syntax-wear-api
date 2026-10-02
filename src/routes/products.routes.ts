import { FastifyInstance } from "fastify";
import { createNewProduct, getProduct, listProducts } from "../controllers/products.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { properties } from "zod";

export default async function productsRoutes(fastify: FastifyInstance) {
  // fastify.addHook("onRequest", authenticate);
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Lista os produtos disponíveis",
        response: {
          200: {
            description: "Lista de produtos",
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
                price: { type: "number" },
                createdAt: { type: "string", format: "date-time" },
                color: { type: "string" },
                description: { type: "string" },
                stock: { type: "number" },
                sizes: {
                  type: "array",
                  items: { type: "string" },
                },
                images: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
                colors: {
                  type: "array",
                  items: { type: "string" },
                },
                slug: { type: "string" },
                active: { type: "boolean" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
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

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        description: "Obter um produto pelo ID",
        params: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
        response: {
          200: {
            descripition: "Produto encontrado",
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
              price: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              color: { type: "string" },
              description: { type: "string" },
              stock: { type: "number" },
              sizes: {
                type: "array",
                items: { type: "string" },
              },
              images: {
                type: "array",
                items: { type: "string", format: "uri" },
              },
              colors: {
                type: "array",
                items: { type: "string" },
              },
              slug: { type: "string" },
              active: { type: "boolean" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
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
        },
      },
    },
    getProduct,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Criar um novo produto",
        required: ["name", "description", "price", "slug", "active", "stock"],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            active: { type: "boolean" },
            stock: { type: "number" },
            colors: {
              type: "array",
              items: { type: "string" },
            },
            images: {
              type: "array",
              items: { type: "string" },
            },
            sizes: {
              type: "array",
              items: { type: "string" },
            }
          },
          
        },
        response: {
          201: {
            description: "Produto criado com sucesso",
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
              price: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              color: { type: "string" },
              description: { type: "string" },
              stock: { type: "number" },
              sizes: {
                type: "array",
                items: { type: "string" },
              },
              images: {
                type: "array",
                items: { type: "string", format: "uri" },
              },
              colors: {
                type: "array",
                items: { type: "string" },
              }
            },
          }
        },
      }
    }, createNewProduct);
  }