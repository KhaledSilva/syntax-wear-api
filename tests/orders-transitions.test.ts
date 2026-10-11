import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { OrderStatus, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const expectOrderServiceError = async (
  operation: Promise<unknown>,
  statusCode: number,
) => {
  const error = await operation.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(OrderServiceError);
  expect(error).toMatchObject({ statusCode });
};

describe("transições de status dos pedidos", () => {
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

  it("permite somente ao ADMIN enviar pedidos pagos e marcar pedidos enviados como entregues", async () => {
    order.status = "PAID";
    const shipped = await updateOrder(order.id, admin, { status: "SHIPPED" });
    expect(shipped.status).toBe("SHIPPED");

    const delivered = await updateOrder(order.id, admin, { status: "DELIVERED" });
    expect(delivered.status).toBe("DELIVERED");
  });

  it("rejeita transições operacionais de envio e entrega solicitadas por compradores", async () => {
    order.status = "PAID";
    await expectOrderServiceError(
      updateOrder(order.id, buyer, { status: "SHIPPED" }),
      403,
    );

    order.status = "SHIPPED";
    await expectOrderServiceError(
      updateOrder(order.id, buyer, { status: "DELIVERED" }),
      403,
    );
  });

  it("rejeita transições inválidas mesmo para ADMIN", async () => {
    await expectOrderServiceError(
      updateOrder(order.id, admin, { status: "DELIVERED" }),
      409,
    );
  });

  it("mantém a verificação de propriedade do pedido durante a atualização", async () => {
    await expectOrderServiceError(
      updateOrder(order.id, otherBuyer, { status: "CANCELLED" }),
      404,
    );
  });

  it("permite ao comprador cancelar pedidos pendentes e bloqueia o cancelamento após o pagamento", async () => {
    const cancelled = await updateOrder(order.id, buyer, { status: "CANCELLED" });
    expect(cancelled.status).toBe("CANCELLED");

    order.status = "PAID";
    await expectOrderServiceError(
      updateOrder(order.id, buyer, { status: "CANCELLED" }),
      403,
    );
  });

  it("aplica por HTTP as mesmas regras de papel, propriedade e transição", async () => {
    const app = Fastify();
    await app.register(jwt, { secret: "test-secret-for-order-route-tests" });
    await app.register(ordersRoutes, { prefix: "/orders" });
    await app.ready();

    try {
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
      expect(buyerShip.statusCode).toBe(403);

      const adminShip = await request(adminToken, "SHIPPED");
      expect(adminShip.statusCode).toBe(200);
      expect(order.status).toBe("SHIPPED");

      const adminDeliver = await request(adminToken, "DELIVERED");
      expect(adminDeliver.statusCode).toBe(200);
      expect(order.status).toBe("DELIVERED");

      const nonOwnerCancel = await request(otherBuyerToken, "CANCELLED");
      expect(nonOwnerCancel.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
