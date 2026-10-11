import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ordersRoutes from "../src/routes/orders.routes";
import {
  createOrder,
  getOrderById,
  getOrders,
  updateOrder,
} from "../src/services/orders.service";

vi.mock("../src/services/orders.service", () => ({
  createOrder: vi.fn(),
  getOrderById: vi.fn(),
  getOrders: vi.fn(),
  updateOrder: vi.fn(),
  OrderServiceError: class OrderServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const order = {
  id: 17,
  userId: 2,
  total: new Prisma.Decimal(179.8),
  status: "PENDING" as const,
  shippingAddress: {
    cep: "01001-000",
    street: "Praça da Sé",
    number: "100",
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
  },
  paymentMethod: "PIX",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  items: [],
} satisfies NonNullable<Awaited<ReturnType<typeof getOrderById>>>;

const createOrderPayload = {
  items: [{ productId: 5, quantity: 2, size: "M" }],
  shippingAddress: {
    cep: "01001-000",
    street: "Praça da Sé",
    number: "100",
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
  },
  paymentMethod: "PIX",
};

describe("Rotas CRUD de pedidos", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  let otherUserToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });

    await app.register(jwt, { secret: "test-orders-jwt-secret" });
    await app.register(ordersRoutes, { prefix: "/orders" });
    await app.ready();

    adminToken = app.jwt.sign({ userId: 1, role: "ADMIN" });
    userToken = app.jwt.sign({ userId: order.userId, role: "USER" });
    otherUserToken = app.jwt.sign({ userId: 3, role: "USER" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("lista pedidos do usuário autenticado e envia seu acesso ao serviço", async () => {
    vi.mocked(getOrders).mockResolvedValue([order]);

    const response = await app.inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getOrders).toHaveBeenCalledWith({ userId: order.userId, isAdmin: false });
    expect(response.json()).toMatchObject([{ id: order.id, userId: order.userId }]);
  });

  it("busca um pedido pelo ID e envia o acesso do usuário ao serviço", async () => {
    vi.mocked(getOrderById).mockResolvedValue(order);

    const response = await app.inject({
      method: "GET",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getOrderById).toHaveBeenCalledWith(order.id, {
      userId: order.userId,
      isAdmin: false,
    });
    expect(response.json()).toMatchObject({ id: order.id, status: "PENDING" });
  });

  it("retorna 404 ao buscar um pedido inexistente", async () => {
    vi.mocked(getOrderById).mockResolvedValue(null);

    const response = await app.inject({
      method: "GET",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: "Pedido não encontrado" });
  });

  it("cria um pedido com os campos obrigatórios e associa o usuário autenticado", async () => {
    vi.mocked(createOrder).mockResolvedValue(order);

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${userToken}` },
      payload: createOrderPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(createOrder).toHaveBeenCalledWith(order.userId, createOrderPayload);
    expect(response.json()).toMatchObject({
      id: order.id,
      userId: order.userId,
      status: "PENDING",
    });
  });

  it.each([
    ["items", { ...createOrderPayload, items: undefined }],
    ["ao menos um item", { ...createOrderPayload, items: [] }],
    ["shippingAddress", { ...createOrderPayload, shippingAddress: undefined }],
    ["paymentMethod", { ...createOrderPayload, paymentMethod: undefined }],
    [
      "productId do item",
      { ...createOrderPayload, items: [{ productId: undefined, quantity: 2, size: "M" }] },
    ],
    [
      "quantity do item",
      { ...createOrderPayload, items: [{ productId: 5, quantity: undefined, size: "M" }] },
    ],
    [
      "size do item",
      { ...createOrderPayload, items: [{ productId: 5, quantity: 2, size: undefined }] },
    ],
    ...(
      ["cep", "street", "number", "neighborhood", "city", "state", "country"] as const
    ).map((field) => [
      `${field} do endereço`,
      {
        ...createOrderPayload,
        shippingAddress: {
          ...createOrderPayload.shippingAddress,
          [field]: undefined,
        },
      },
    ]),
  ])("rejeita a criação sem %s e não chama o serviço", async (_field, payload) => {
    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${userToken}` },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("atualiza um pedido com os campos enviados e respeita o usuário autenticado", async () => {
    vi.mocked(updateOrder).mockResolvedValue(order);

    const response = await app.inject({
      method: "PUT",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { shippingAddress: { city: "Santo André" } },
    });

    expect(response.statusCode).toBe(200);
    expect(updateOrder).toHaveBeenCalledWith(
      order.id,
      { userId: order.userId, isAdmin: false },
      { shippingAddress: { city: "Santo André" } },
    );
    expect(response.json()).toMatchObject({ id: order.id });
  });

  it("rejeita atualização sem campos ou sem os campos obrigatórios de um item", async () => {
    const emptyResponse = await app.inject({
      method: "PUT",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    const invalidItemResponse = await app.inject({
      method: "PUT",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { items: [{ productId: 5, quantity: 2 }] },
    });

    expect(emptyResponse.statusCode).toBe(400);
    expect(invalidItemResponse.statusCode).toBe(400);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("cancela um pedido do usuário autenticado", async () => {
    vi.mocked(updateOrder).mockResolvedValue({ ...order, status: "CANCELLED" });

    const response = await app.inject({
      method: "DELETE",
      url: `/orders/${order.id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(updateOrder).toHaveBeenCalledWith(
      order.id,
      { userId: order.userId, isAdmin: false },
      { status: "CANCELLED" },
    );
    expect(response.json()).toMatchObject({ id: order.id, status: "CANCELLED" });
  });

  it("permite ao ADMIN acessar a lista global de pedidos", async () => {
    vi.mocked(getOrders).mockResolvedValue([order]);

    const response = await app.inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getOrders).toHaveBeenCalledWith({ userId: 1, isAdmin: true });
  });

  it("exige autenticação para listar pedidos", async () => {
    const response = await app.inject({ method: "GET", url: "/orders" });

    expect(response.statusCode).toBe(401);
    expect(getOrders).not.toHaveBeenCalled();
  });
});
