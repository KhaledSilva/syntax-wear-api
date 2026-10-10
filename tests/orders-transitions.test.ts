import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { OrderStatus, Prisma } from "@prisma/client";
import ordersRoutes from "../src/routes/orders.routes";
import { OrderServiceError, updateOrder } from "../src/services/orders.service";
import { prisma } from "../src/utils/prisma";

type MockOrder = {
  id: number;
  userId: number;
  status: OrderStatus;
  shippingAddress: Prisma.JsonValue;
};

type MockTransaction = {
  order: {
    findFirst: (args: {
      where: { id: number; userId?: number };
    }) => Promise<MockOrder | null>;
    update: (args: {
      where: { id: number };
      data: Prisma.OrderUpdateInput;
    }) => Promise<MockOrder>;
  };
};

const order: MockOrder = {
  id: 1,
  userId: 10,
  status: "PENDING",
  shippingAddress: {},
};
const originalTransactionDescriptor = Object.getOwnPropertyDescriptor(
  prisma,
  "$transaction",
);

const setupMockTransaction = () => {
  const transaction: MockTransaction = {
    order: {
      findFirst: async ({ where }) =>
        where.id === order.id &&
        (where.userId === undefined || where.userId === order.userId)
          ? { ...order }
          : null,
      update: async ({ data }) => {
        if (typeof data.status === "string") {
          order.status = data.status as OrderStatus;
        }
        return { ...order };
      },
    },
  };

  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    writable: true,
    value: async (callback: (tx: MockTransaction) => Promise<unknown>) =>
      callback(transaction),
  });
};

const buyer = { userId: order.userId, isAdmin: false };
const otherBuyer = { userId: order.userId + 1, isAdmin: false };
const admin = { userId: 99, isAdmin: true };

describe("order status transitions", () => {
  beforeEach(() => {
    order.status = "PENDING";
    setupMockTransaction();
  });

  afterEach(() => {
    if (originalTransactionDescriptor) {
      Object.defineProperty(prisma, "$transaction", originalTransactionDescriptor);
    } else {
      Reflect.deleteProperty(prisma, "$transaction");
    }
  });

  it("allows only ADMIN to ship paid orders and mark shipped orders delivered", async () => {
    order.status = "PAID";
    const shipped = await updateOrder(order.id, admin, { status: "SHIPPED" });
    assert.equal(shipped.status, "SHIPPED");

    const delivered = await updateOrder(order.id, admin, { status: "DELIVERED" });
    assert.equal(delivered.status, "DELIVERED");
  });

  it("rejects operational shipping and delivery transitions from buyers", async () => {
    order.status = "PAID";
    await assert.rejects(
      updateOrder(order.id, buyer, { status: "SHIPPED" }),
      (error: unknown) =>
        error instanceof OrderServiceError && error.statusCode === 403,
    );

    order.status = "SHIPPED";
    await assert.rejects(
      updateOrder(order.id, buyer, { status: "DELIVERED" }),
      (error: unknown) =>
        error instanceof OrderServiceError && error.statusCode === 403,
    );
  });

  it("rejects invalid transitions even for ADMIN", async () => {
    await assert.rejects(
      updateOrder(order.id, admin, { status: "DELIVERED" }),
      (error: unknown) =>
        error instanceof OrderServiceError && error.statusCode === 409,
    );
  });

  it("keeps order ownership checks when updating", async () => {
    await assert.rejects(
      updateOrder(order.id, otherBuyer, { status: "CANCELLED" }),
      (error: unknown) =>
        error instanceof OrderServiceError && error.statusCode === 404,
    );
  });

  it("keeps buyer cancellation for pending orders and blocks cancellation after payment", async () => {
    const cancelled = await updateOrder(order.id, buyer, { status: "CANCELLED" });
    assert.equal(cancelled.status, "CANCELLED");

    order.status = "PAID";
    await assert.rejects(
      updateOrder(order.id, buyer, { status: "CANCELLED" }),
      (error: unknown) =>
        error instanceof OrderServiceError && error.statusCode === 403,
    );
  });

  it("enforces the same role, ownership, and transition rules through HTTP", async (context) => {
    const app = Fastify();
    await app.register(jwt, { secret: "test-secret-for-order-route-tests" });
    await app.register(ordersRoutes, { prefix: "/orders" });
    await app.ready();
    context.after(() => app.close());

    const buyerToken = app.jwt.sign({ userId: buyer.userId, role: "USER" });
    const otherBuyerToken = app.jwt.sign({ userId: otherBuyer.userId, role: "USER" });
    const adminToken = app.jwt.sign({ userId: admin.userId, role: "ADMIN" });
    const request = (token: string, status: OrderStatus) =>
      app.inject({
        method: "PUT",
        url: `/orders/${order.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status },
      });

    order.status = "PAID";
    const buyerShip = await request(buyerToken, "SHIPPED");
    assert.equal(buyerShip.statusCode, 403);

    const adminShip = await request(adminToken, "SHIPPED");
    assert.equal(adminShip.statusCode, 200);
    assert.equal(order.status, "SHIPPED");

    const adminDeliver = await request(adminToken, "DELIVERED");
    assert.equal(adminDeliver.statusCode, 200);
    assert.equal(order.status, "DELIVERED");

    const nonOwnerCancel = await request(otherBuyerToken, "CANCELLED");
    assert.equal(nonOwnerCancel.statusCode, 404);
  });
});
