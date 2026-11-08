import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  confirmOrderPayment,
  createOrder,
  expireOrderReservations,
  markOrderPaymentFailed,
  recordPaymentSession,
  updateOrder,
} from "../src/services/orders.service";
import { prisma } from "../src/utils/prisma";
import type { CreateOrder } from "../src/types";

type TestProduct = {
  id: number;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  active: boolean;
  sizes: string[];
};

type TestOrder = {
  id: number;
  userId: number;
  total: Prisma.Decimal;
  status: string;
  paymentStatus: string;
  stockReservationStatus: string;
  reservationExpiresAt: Date | null;
  idempotencyKey: string | null;
  idempotencyScope: string;
  idempotencyHash: string | null;
  paymentSessionId: string | null;
  shippingAddress: CreateOrder["shippingAddress"];
  shippingCost: Prisma.Decimal;
  paymentMethod: string;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    size: string;
  }>;
};

const requestData: CreateOrder = {
  items: [{ productId: 1, quantity: 1, size: "M" }],
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
  shippingCost: 4,
};

describe("serviço de pedidos e reserva de estoque", () => {
  let products: TestProduct[];
  let orders: TestOrder[];
  let nextOrderId: number;
  let transaction: Record<string, any>;

  const findOrder = (where: Record<string, any>) =>
    orders.find((order) => {
      if (where.id !== undefined && order.id !== where.id) return false;
      if (where.userId !== undefined && order.userId !== where.userId) return false;
      if (
        where.paymentSessionId !== undefined &&
        order.paymentSessionId !== where.paymentSessionId
      ) {
        return false;
      }
      const unique = where.userId_idempotencyScope_idempotencyKey;
      if (
        unique &&
        (order.userId !== unique.userId ||
          order.idempotencyScope !== unique.idempotencyScope ||
          order.idempotencyKey !== unique.idempotencyKey)
      ) {
        return false;
      }
      if (
        where.status?.in &&
        !where.status.in.includes(order.status)
      ) {
        return false;
      }
      if (
        where.status !== undefined &&
        typeof where.status === "string" &&
        order.status !== where.status
      ) {
        return false;
      }
      if (
        where.paymentStatus?.in &&
        !where.paymentStatus.in.includes(order.paymentStatus)
      ) {
        return false;
      }
      if (
        where.stockReservationStatus !== undefined &&
        order.stockReservationStatus !== where.stockReservationStatus
      ) {
        return false;
      }
      if (
        where.reservationExpiresAt?.lte &&
        (!order.reservationExpiresAt ||
          order.reservationExpiresAt > where.reservationExpiresAt.lte)
      ) {
        return false;
      }
      return true;
    });

  beforeEach(() => {
    vi.clearAllMocks();
    products = [
      {
        id: 1,
        name: "Camiseta",
        price: new Prisma.Decimal("15.25"),
        stock: 10,
        active: true,
        sizes: ["M", "G"],
      },
    ];
    orders = [];
    nextOrderId = 1;

    transaction = {
      $queryRaw: vi.fn(async () => []),
      product: {
        findMany: vi.fn(async ({ where }: any) =>
          products.filter((product) => where.id.in.includes(product.id)),
        ),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const product = products.find(({ id }) => id === where.id);
          if (
            !product ||
            (where.active !== undefined && product.active !== where.active) ||
            (where.stock?.gte !== undefined && product.stock < where.stock.gte)
          ) {
            return { count: 0 };
          }
          if (data.stock.decrement !== undefined) {
            product.stock -= data.stock.decrement;
          } else {
            product.stock += data.stock.increment;
          }
          return { count: 1 };
        }),
      },
      order: {
        findUnique: vi.fn(async ({ where }: any) => findOrder(where) ?? null),
        findUniqueOrThrow: vi.fn(async ({ where }: any) => {
          const order = findOrder(where);
          if (!order) throw new Error("Missing test order");
          return order;
        }),
        findFirst: vi.fn(async ({ where }: any) => findOrder(where) ?? null),
        findMany: vi.fn(async ({ where, take }: any) =>
          orders.filter((order) => findOrder({ ...where, id: order.id })).slice(0, take),
        ),
        create: vi.fn(async ({ data }: any) => {
          const order: TestOrder = {
            ...data,
            id: nextOrderId++,
            status: data.status ?? "PENDING",
            paymentStatus: data.paymentStatus ?? "NOT_STARTED",
            stockReservationStatus:
              data.stockReservationStatus ?? "RELEASED",
            items: data.items.create.map((item: any, index: number) => ({
              ...item,
              id: index + 1,
            })),
          };
          orders.push(order);
          return order;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const order = findOrder(where);
          if (!order) throw new Error("Missing test order");
          Object.assign(order, data);
          if (data.items?.create) {
            order.items = data.items.create.map((item: any, index: number) => ({
              ...item,
              id: index + 1,
            }));
          }
          return order;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const order = findOrder(where);
          if (!order) return { count: 0 };
          Object.assign(order, data);
          return { count: 1 };
        }),
      },
    };

    vi.mocked(prisma.order.findUnique).mockImplementation(
      async ({ where }: any) => findOrder(where) as never,
    );
    vi.mocked(prisma.order.findMany).mockImplementation(
      async ({ where, take }: any) =>
        orders
          .filter((order) => findOrder({ ...where, id: order.id }))
          .slice(0, take) as never,
    );
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: any) => callback(transaction),
    );
  });

  it("consolida itens repetidos, usa preço do banco e soma o frete", async () => {
    const order = await createOrder(
      7,
      {
        ...requestData,
        items: [
          { productId: 1, quantity: 1, size: "M" },
          { productId: 1, quantity: 2, size: "M" },
        ],
      },
      "create-order-1",
    );

    expect(products[0].stock).toBe(7);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productName: "Camiseta",
      quantity: 3,
      unitPrice: new Prisma.Decimal("15.25"),
    });
    expect(order.total).toEqual(new Prisma.Decimal("49.75"));
    expect(orders[0].stockReservationStatus).toBe("RESERVED");
    expect(order.reservationExpiresAt).toBeInstanceOf(Date);
  });

  it("valida existência, atividade, tamanho e estoque total antes de reservar", async () => {
    products[0].stock = 2;
    await expect(
      createOrder(
        7,
        {
          ...requestData,
          items: [
            { productId: 1, quantity: 1, size: "M" },
            { productId: 1, quantity: 2, size: "G" },
          ],
        },
        "combined-stock-key",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(products[0].stock).toBe(2);

    products[0].stock = 10;
    products[0].active = false;
    await expect(
      createOrder(7, requestData, "inactive-key"),
    ).rejects.toMatchObject({ statusCode: 409 });

    products[0].active = true;
    await expect(
      createOrder(
        7,
        { ...requestData, items: [{ productId: 1, quantity: 1, size: "P" }] },
        "invalid-size-key",
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      createOrder(
        7,
        { ...requestData, items: [{ productId: 404, quantity: 1, size: "M" }] },
        "missing-product-key",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(products[0].stock).toBe(10);
  });

  it("retorna o mesmo pedido no retry e rejeita a mesma chave com conteúdo diferente", async () => {
    const first = await createOrder(7, requestData, "stable-key");
    const stockAfterFirst = products[0].stock;
    const retry = await createOrder(7, requestData, "stable-key");

    expect(retry.id).toBe(first.id);
    expect(products[0].stock).toBe(stockAfterFirst);

    await expect(
      createOrder(7, { ...requestData, shippingCost: 5 }, "stable-key"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(products[0].stock).toBe(stockAfterFirst);

    const anotherUserOrder = await createOrder(8, requestData, "stable-key");
    expect(anotherUserOrder.id).not.toBe(first.id);
    expect(products[0].stock).toBe(stockAfterFirst - 1);
  });

  it("libera uma reserva uma única vez ao cancelar antes do pagamento", async () => {
    const order = await createOrder(7, requestData, "cancel-key");

    const cancelled = await updateOrder(
      order.id,
      { userId: 7, isAdmin: false },
      { status: "CANCELLED" },
    );
    expect(cancelled.stockReservationStatus).toBe("RELEASED");
    expect(products[0].stock).toBe(10);

    await expect(
      updateOrder(order.id, { userId: 7, isAdmin: false }, { status: "CANCELLED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(products[0].stock).toBe(10);
  });

  it("ajusta somente a diferença de estoque ao editar itens pendentes", async () => {
    const order = await createOrder(7, requestData, "edit-key");
    const updated = await updateOrder(
      order.id,
      { userId: 7, isAdmin: false },
      {
        items: [{ productId: 1, quantity: 10, size: "M" }],
      },
    );

    expect(products[0].stock).toBe(0);
    expect(updated.total).toEqual(new Prisma.Decimal("156.5"));
    expect(orders[0].items[0].quantity).toBe(10);
  });

  it("não libera estoque expirado enquanto o pagamento está em processamento", async () => {
    const order = await createOrder(7, requestData, "processing-key");
    await recordPaymentSession(order.id, "session-1");

    const processed = await expireOrderReservations(
      new Date(Date.now() + 31 * 60 * 1000),
    );
    expect(processed).toBe(0);
    expect(products[0].stock).toBe(9);

    await markOrderPaymentFailed("session-1");
    expect(
      await expireOrderReservations(new Date(Date.now() + 31 * 60 * 1000)),
    ).toBe(0);
    await confirmOrderPayment("session-1");
    await confirmOrderPayment("session-1");
    expect(products[0].stock).toBe(9);
    expect(orders[0].stockReservationStatus).toBe("CONSUMED");
    expect(
      await expireOrderReservations(new Date(Date.now() + 31 * 60 * 1000)),
    ).toBe(0);
    expect(products[0].stock).toBe(9);
  });

  it("expira e libera uma reserva sem descontar estoque novamente", async () => {
    const order = await createOrder(7, requestData, "expire-key");

    expect(
      await expireOrderReservations(new Date(Date.now() + 31 * 60 * 1000)),
    ).toBe(1);
    expect(orders[0].status).toBe("CANCELLED");
    expect(orders[0].stockReservationStatus).toBe("RELEASED");
    expect(products[0].stock).toBe(10);
    expect(
      await expireOrderReservations(new Date(Date.now() + 31 * 60 * 1000)),
    ).toBe(0);
    expect(products[0].stock).toBe(10);
    expect(order.id).toBe(orders[0].id);
  });
});
