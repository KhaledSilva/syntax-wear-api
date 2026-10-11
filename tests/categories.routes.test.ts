import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import type { Category } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import categoriesRoutes from "../src/routes/categories.routes";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../src/services/categories.service";

vi.mock("../src/services/categories.service", () => ({
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getCategories: vi.fn(),
  getCategoryById: vi.fn(),
  updateCategory: vi.fn(),
}));

const category: Category = {
  id: 3,
  name: "Camisetas",
  slug: "camisetas",
  description: "Camisetas para todos os estilos",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Rotas CRUD de categorias", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    await app.register(jwt, { secret: "test-categories-jwt-secret" });
    await app.register(categoriesRoutes, { prefix: "/categories" });
    await app.ready();

    adminToken = app.jwt.sign({ userId: 1, role: "ADMIN" });
    userToken = app.jwt.sign({ userId: 2, role: "USER" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("lista categorias", async () => {
    vi.mocked(getCategories).mockResolvedValue([category]);

    const response = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getCategories).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject([
      { id: category.id, name: category.name, slug: category.slug },
    ]);
  });

  it("busca uma categoria pelo ID numérico", async () => {
    vi.mocked(getCategoryById).mockResolvedValue(category);

    const response = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getCategoryById).toHaveBeenCalledWith(category.id);
    expect(response.json()).toMatchObject({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });
  });

  it("cria uma categoria informando apenas o campo obrigatório name", async () => {
    vi.mocked(createCategory).mockResolvedValue(category);

    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: category.name },
    });

    expect(response.statusCode).toBe(201);
    expect(createCategory).toHaveBeenCalledWith({
      name: category.name,
      slug: category.slug,
    });
    expect(response.json()).toEqual({ message: "Categoria criada com sucesso" });
  });

  it("rejeita a criação sem name e não chama o serviço", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { description: "Categoria sem nome" },
    });

    expect(response.statusCode).toBe(400);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("atualiza uma categoria e regenera o slug quando o nome muda", async () => {
    vi.mocked(updateCategory).mockResolvedValue(category);

    const response = await app.inject({
      method: "PUT",
      url: `/categories/${category.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Camisetas Básicas" },
    });

    expect(response.statusCode).toBe(200);
    expect(updateCategory).toHaveBeenCalledWith(category.id, {
      name: "Camisetas Básicas",
      slug: "camisetas-basicas",
    });
    expect(response.json()).toMatchObject({ id: category.id });
  });

  it("desativa uma categoria", async () => {
    vi.mocked(deleteCategory).mockResolvedValue(category);

    const response = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(deleteCategory).toHaveBeenCalledWith(category.id);
    expect(response.json()).toEqual({
      message: "Categoria desativada com sucesso",
    });
  });

  it("bloqueia mutações por não administradores sem chamar o serviço", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: category.name },
    });

    expect(response.statusCode).toBe(403);
    expect(createCategory).not.toHaveBeenCalled();
  });
});
