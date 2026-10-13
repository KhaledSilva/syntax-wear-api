import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { Prisma, type Product } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import productsRoutes from "../src/routes/products.routes";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "../src/services/products.service";

vi.mock("../src/services/products.service", () => ({
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductById: vi.fn(),
  getProducts: vi.fn(),
  updateProduct: vi.fn(),
}));

const product: Product = {
  id: 17,
  name: "Camiseta Básica",
  slug: "camiseta-basica",
  description: "Camiseta de algodão",
  price: new Prisma.Decimal(89.9),
  images: [],
  sizes: ["M"],
  colors: ["preto"],
  stock: 12,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  categoryId: 3,
};

describe("Rotas CRUD de produtos", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    await app.register(jwt, { secret: "test-products-jwt-secret" });
    await app.register(productsRoutes, { prefix: "/products" });
    await app.ready();

    adminToken = app.jwt.sign({ userId: 1, role: "ADMIN" });
    userToken = app.jwt.sign({ userId: 2, role: "USER" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("lista produtos e envia filtros validados ao serviço", async () => {
    vi.mocked(getProducts).mockResolvedValue({
      data: [product],
      total: 1,
      page: 2,
      limit: 5,
    });

    const response = await app.inject({
      method: "GET",
      url: "/products?page=2&limit=5&active=true",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getProducts).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      active: true,
    });
    expect(response.json()).toEqual({
      data: [
        expect.objectContaining({
          id: product.id,
          name: product.name,
          active: true,
        }),
      ],
      total: 1,
      page: 2,
      limit: 5,
    });
  });

  it("busca um produto pelo ID numérico", async () => {
    vi.mocked(getProductById).mockResolvedValue({
      ...product,
      category: {
        id: 3,
        name: "Camisetas",
        slug: "camisetas",
        description: null,
        active: true,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/products/${product.id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getProductById).toHaveBeenCalledWith(product.id);
    expect(response.json()).toMatchObject({
      id: product.id,
      name: product.name,
      category: { id: 3, name: "Camisetas" },
    });
  });

  it("cria um produto com slug gerado para ADMIN", async () => {
    vi.mocked(createProduct).mockResolvedValue(product);

    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Camiseta Básica",
        description: "Camiseta de algodão",
        price: 89.9,
        categoryId: 3,
        active: true,
        stock: 12,
        colors: ["preto"],
        sizes: ["M"],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Camiseta Básica",
        slug: "camiseta-basica",
        categoryId: 3,
      }),
    );
    expect(response.json()).toEqual({ message: "Produto criado com sucesso" });
  });

  it("atualiza um produto e regenera o slug quando o nome muda", async () => {
    vi.mocked(updateProduct).mockResolvedValue(product);

    const response = await app.inject({
      method: "PUT",
      url: `/products/${product.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Camiseta Nova", price: 99 },
    });

    expect(response.statusCode).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(product.id, {
      name: "Camiseta Nova",
      slug: "camiseta-nova",
      price: 99,
    });
    expect(response.json()).toMatchObject({ id: product.id });
  });

  it("desativa um produto e não retorna conteúdo", async () => {
    vi.mocked(deleteProduct).mockResolvedValue(undefined);

    const response = await app.inject({
      method: "DELETE",
      url: `/products/${product.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(204);
    expect(deleteProduct).toHaveBeenCalledWith(product.id);
    expect(response.body).toBe("");
  });

  it("bloqueia a criação por não administradores sem chamar o serviço", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/products",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: "Camiseta Básica",
        description: "Camiseta de algodão",
        price: 89.9,
        categoryId: 3,
        active: true,
        stock: 12,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(createProduct).not.toHaveBeenCalled();
  });
});
