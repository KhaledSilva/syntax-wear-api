import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { CreateOrder, OrderStatus, UpdateOrder } from "../types";

const RESERVATION_DURATION_MS = 30 * 60 * 1000;
const IDEMPOTENCY_SCOPE = "orders:create";
const EXPIRABLE_ORDER_STATUSES = ["PENDING", "CONFIRMED"] as const;
const EXPIRABLE_PAYMENT_STATUSES = ["NOT_STARTED", "EXPIRED"] as const;
const MAX_DATABASE_INTEGER = 2_147_483_647;

const orderDetails = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
        },
      },
    },
  },
};

const publicOrderDetails = {
  omit: {
    idempotencyKey: true,
    idempotencyScope: true,
    idempotencyHash: true,
    paymentSessionId: true,
    stockReservationStatus: true,
    reservationExpiresAt: true,
  },
  include: orderDetails,
};

const idempotencyOrderDetails = {
  include: orderDetails,
};

type OrderAccess = {
  userId: number;
  isAdmin: boolean;
};

type RequestedOrderItem = CreateOrder["items"][number];

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

const aggregateItemsByProduct = (
  items: Array<{ productId: number; quantity: number }>,
) => {
  const quantities = new Map<number, number>();

  for (const item of items) {
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > MAX_DATABASE_INTEGER) {
      throw new OrderServiceError(
        `Quantidade total inválida para o produto ${item.productId}`,
        400,
      );
    }
    quantities.set(item.productId, quantity);
  }

  return quantities;
};

const prepareOrderItems = async (
  transaction: Prisma.TransactionClient,
  data: Pick<CreateOrder, "items">,
  reservedItems: Array<{ productId: number; quantity: number }> = [],
) => {
  const consolidatedItems = new Map<string, RequestedOrderItem>();

  for (const item of data.items) {
    const key = JSON.stringify([item.productId, item.size]);
    const existing = consolidatedItems.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;

    if (!Number.isSafeInteger(quantity)) {
      throw new OrderServiceError(
        `Quantidade total inválida para o produto ${item.productId}`,
        400,
      );
    }

    consolidatedItems.set(key, { ...item, quantity });
  }

  const requestedItems = [...consolidatedItems.values()];
  const productIds = [...new Set(requestedItems.map(({ productId }) => productId))];
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(
      [...productIds].sort((a, b) => a - b),
    )}) ORDER BY "id" FOR UPDATE`,
  );
  const products = await transaction.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      active: true,
      sizes: true,
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const productId of productIds) {
    if (!productsById.has(productId)) {
      throw new OrderServiceError(`Produto ${productId} não encontrado`, 404);
    }
  }

  for (const item of requestedItems) {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new OrderServiceError(`Produto ${item.productId} não encontrado`, 404);
    }
    if (!product.active) {
      throw new OrderServiceError(`Produto ${item.productId} está inativo`, 409);
    }
    if (!Array.isArray(product.sizes) || !product.sizes.includes(item.size)) {
      throw new OrderServiceError(
        `Tamanho ${item.size} indisponível para o produto ${item.productId}`,
        409,
      );
    }
  }

  const stockByProduct = aggregateItemsByProduct(requestedItems);
  const reservedByProduct = aggregateItemsByProduct(reservedItems);
  for (const [productId, quantity] of [...stockByProduct].sort(
    ([left], [right]) => left - right,
  )) {
    const product = productsById.get(productId);
    const availableStock = product
      ? product.stock + (reservedByProduct.get(productId) ?? 0)
      : 0;
    if (!product || !Number.isSafeInteger(availableStock) || availableStock < quantity) {
      throw new OrderServiceError(
        `Estoque insuficiente para o produto ${productId}`,
        409,
      );
    }
  }

  const items = requestedItems.map(({ productId, quantity, size }) => {
    const product = productsById.get(productId);
    if (!product) {
      throw new OrderServiceError(`Produto ${productId} não encontrado`, 404);
    }

    return {
      productId,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      size,
    };
  });

  const subtotal = items.reduce(
    (sum, item) => sum.plus(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

  return { items, subtotal };
};

const changeProductStock = async (
  transaction: Prisma.TransactionClient,
  productId: number,
  delta: number,
) => {
  if (delta === 0) return;

  if (delta > 0) {
    const result = await transaction.product.updateMany({
      where: {
        id: productId,
        active: true,
        stock: { gte: delta },
      },
      data: { stock: { decrement: delta } },
    });

    if (result.count !== 1) {
      throw new OrderServiceError(
        `Estoque insuficiente ou produto indisponível: ${productId}`,
        409,
      );
    }
    return;
  }

  const result = await transaction.product.updateMany({
    where: { id: productId },
    data: { stock: { increment: -delta } },
  });
  if (result.count !== 1) {
    throw new OrderServiceError(
      `Produto ${productId} não encontrado ao liberar o estoque`,
      404,
    );
  }
};

const reserveItems = async (
  transaction: Prisma.TransactionClient,
  items: Array<{ productId: number; quantity: number }>,
) => {
  const quantities = aggregateItemsByProduct(items);
  for (const [productId, quantity] of [...quantities].sort(
    ([left], [right]) => left - right,
  )) {
    await changeProductStock(transaction, productId, quantity);
  }
};

const releaseItems = async (
  transaction: Prisma.TransactionClient,
  items: Array<{ productId: number; quantity: number }>,
) => {
  const quantities = aggregateItemsByProduct(items);
  for (const [productId, quantity] of [...quantities].sort(
    ([left], [right]) => left - right,
  )) {
    await changeProductStock(transaction, productId, -quantity);
  }
};

const adjustReservedItems = async (
  transaction: Prisma.TransactionClient,
  currentItems: Array<{ productId: number; quantity: number }>,
  nextItems: Array<{ productId: number; quantity: number }>,
) => {
  const currentQuantities = aggregateItemsByProduct(currentItems);
  const nextQuantities = aggregateItemsByProduct(nextItems);
  const productIds = [...new Set([
    ...currentQuantities.keys(),
    ...nextQuantities.keys(),
  ])].sort((left, right) => left - right);

  for (const productId of productIds) {
    const delta =
      (nextQuantities.get(productId) ?? 0) -
      (currentQuantities.get(productId) ?? 0);
    await changeProductStock(transaction, productId, delta);
  }
};

const lockOrder = async (
  transaction: Prisma.TransactionClient,
  id: number,
) => {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`,
  );
};

const shippingAddressData = (shippingAddress: CreateOrder["shippingAddress"]) => ({
  cep: shippingAddress.cep,
  street: shippingAddress.street,
  number: shippingAddress.number,
  ...(shippingAddress.complement !== undefined && {
    complement: shippingAddress.complement,
  }),
  neighborhood: shippingAddress.neighborhood,
  city: shippingAddress.city,
  state: shippingAddress.state,
  country: shippingAddress.country,
});

const mergeShippingAddress = (
  currentAddress: Prisma.JsonValue,
  addressChanges: NonNullable<UpdateOrder["shippingAddress"]>,
) => {
  if (
    typeof currentAddress !== "object" ||
    currentAddress === null ||
    Array.isArray(currentAddress)
  ) {
    throw new OrderServiceError("O endereço atual do pedido é inválido", 409);
  }

  return {
    ...currentAddress,
    ...addressChanges,
  };
};

const orderData = (data: CreateOrder) => ({
  paymentMethod: data.paymentMethod,
  shippingAddress: shippingAddressData(data.shippingAddress),
  shippingCost: new Prisma.Decimal(data.shippingCost),
});

const makeRequestHash = (userId: number, data: CreateOrder) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        operation: IDEMPOTENCY_SCOPE,
        userId,
        items: data.items,
        shippingAddress: data.shippingAddress,
        paymentMethod: data.paymentMethod,
        shippingCost: data.shippingCost.toString(),
      }),
    )
    .digest("hex");

export const normalizeIdempotencyKey = (key: string) => {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0 || normalizedKey.length > 255) {
    throw new OrderServiceError("Header Idempotency-Key inválido", 400);
  }
  return normalizedKey;
};

const findIdempotentOrder = (
  transaction: Pick<Prisma.TransactionClient, "order">,
  userId: number,
  idempotencyKey: string,
) =>
  transaction.order.findUnique({
    where: {
      userId_idempotencyScope_idempotencyKey: {
        userId,
        idempotencyScope: IDEMPOTENCY_SCOPE,
        idempotencyKey,
      },
    },
    ...idempotencyOrderDetails,
  });

const returnExistingIdempotentOrder = <
  T extends {
    idempotencyHash: string | null;
    idempotencyKey: string | null;
    idempotencyScope: string;
    paymentSessionId: string | null;
    stockReservationStatus: string;
    reservationExpiresAt: Date | null;
  },
>(
  order: T,
  requestHash: string,
) => {
  if (order.idempotencyHash !== requestHash) {
    throw new OrderServiceError(
      "Idempotency-Key já utilizada com dados diferentes",
      409,
    );
  }
  const {
    idempotencyKey: _idempotencyKey,
    idempotencyScope: _idempotencyScope,
    idempotencyHash: _idempotencyHash,
    paymentSessionId: _paymentSessionId,
    stockReservationStatus: _stockReservationStatus,
    reservationExpiresAt: _reservationExpiresAt,
    ...publicOrder
  } = order;
  return publicOrder;
};

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const createOrder = async (
  userId: number,
  data: CreateOrder,
  requestIdempotencyKey: string,
) => {
  const idempotencyKey = normalizeIdempotencyKey(requestIdempotencyKey);
  const idempotencyHash = makeRequestHash(userId, data);
  const existingOrder = await findIdempotentOrder(
    prisma,
    userId,
    idempotencyKey,
  );
  if (existingOrder) {
    return returnExistingIdempotentOrder(existingOrder, idempotencyHash);
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const concurrentOrder = await findIdempotentOrder(
        transaction,
        userId,
        idempotencyKey,
      );
      if (concurrentOrder) {
        return returnExistingIdempotentOrder(concurrentOrder, idempotencyHash);
      }

      const { items, subtotal } = await prepareOrderItems(transaction, data);
      await reserveItems(transaction, items);
      const shippingCost = new Prisma.Decimal(data.shippingCost);

      return transaction.order.create({
        data: {
          userId,
          total: subtotal.plus(shippingCost),
          ...orderData(data),
          paymentStatus: "NOT_STARTED",
          stockReservationStatus: "RESERVED",
          reservationExpiresAt: new Date(Date.now() + RESERVATION_DURATION_MS),
          idempotencyKey,
          idempotencyScope: IDEMPOTENCY_SCOPE,
          idempotencyHash,
          items: { create: items },
        },
        ...publicOrderDetails,
      });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const createdOrder = await findIdempotentOrder(
      prisma,
      userId,
      idempotencyKey,
    );
    if (!createdOrder) throw error;
    return returnExistingIdempotentOrder(createdOrder, idempotencyHash);
  }
};

export const assertOrderCanStartCheckout = async (
  orderId: number,
  userId: number,
) =>
  prisma.$transaction(async (transaction) => {
    await lockOrder(transaction, orderId);

    const order = await transaction.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        paymentSessionId: true,
        stockReservationStatus: true,
        reservationExpiresAt: true,
      },
    });

    if (!order || order.userId !== userId) {
      throw new OrderServiceError("Pedido não encontrado", 404);
    }

    const hasActiveReservation =
      order.stockReservationStatus === "RESERVED" &&
      ((order.paymentStatus === "NOT_STARTED" &&
        order.reservationExpiresAt !== null &&
        order.reservationExpiresAt > new Date()) ||
        (order.paymentStatus === "PROCESSING" &&
          order.paymentSessionId !== null));

    if (order.status !== "PENDING" || !hasActiveReservation) {
      throw new OrderServiceError(
        "O pedido não está pendente ou não possui uma reserva ativa para checkout",
        409,
      );
    }

    return order;
  });

export const updateOrder = async (
  id: number,
  access: OrderAccess,
  input: UpdateOrder,
) =>
  prisma.$transaction(async (transaction) => {
    await lockOrder(transaction, id);

    const existingOrder = await transaction.order.findFirst({
      where: {
        id,
        ...(access.isAdmin ? {} : { userId: access.userId }),
      },
      select: {
        id: true,
        status: true,
        shippingAddress: true,
        shippingCost: true,
        paymentStatus: true,
        stockReservationStatus: true,
        reservationExpiresAt: true,
        items: {
          select: { productId: true, quantity: true },
        },
      },
    });

    if (!existingOrder) {
      throw new OrderServiceError("Pedido não encontrado", 404);
    }

    const hasOrderData =
      input.items !== undefined ||
      input.shippingAddress !== undefined ||
      input.paymentMethod !== undefined;
    const requestedStatus = input.status;

    if (
      requestedStatus !== undefined &&
      requestedStatus !== "CANCELLED" &&
      !access.isAdmin
    ) {
      throw new OrderServiceError(
        "Somente ADMIN pode realizar transições operacionais do pedido",
        403,
      );
    }

    if (hasOrderData && existingOrder.status !== "PENDING") {
      throw new OrderServiceError("Somente pedidos pendentes podem ser atualizados", 409);
    }
    if (
      hasOrderData &&
      existingOrder.paymentStatus !== "NOT_STARTED"
    ) {
      throw new OrderServiceError(
        "O pedido não pode ser alterado após o início do pagamento",
        409,
      );
    }

    if (
      requestedStatus !== undefined &&
      requestedStatus !== existingOrder.status &&
      !isValidOrderTransition(existingOrder.status, requestedStatus)
    ) {
      throw new OrderServiceError(
        `Transição de ${existingOrder.status} para ${requestedStatus} não permitida`,
        409,
      );
    }

    if (
      requestedStatus === "CANCELLED" &&
      (existingOrder.paymentStatus === "PROCESSING" ||
        existingOrder.paymentStatus === "FAILED")
    ) {
      throw new OrderServiceError(
        "O pagamento ainda pode ser confirmado; aguarde a confirmação ou expiração da sessão antes de cancelar",
        409,
      );
    }
    if (
      requestedStatus === "CANCELLED" &&
      existingOrder.paymentStatus === "SUCCEEDED" &&
      existingOrder.status !== "PAID"
    ) {
      throw new OrderServiceError(
        "O pagamento foi confirmado, mas o pedido ainda não foi atualizado; reconcilie o pedido antes de cancelar",
        409,
      );
    }

    if (
      requestedStatus === "CANCELLED" &&
      existingOrder.status === "PAID" &&
      !access.isAdmin
    ) {
      throw new OrderServiceError("Somente ADMIN pode cancelar um pedido após o pagamento", 403);
    }

    if (!hasOrderData && requestedStatus === existingOrder.status) {
      throw new OrderServiceError("O pedido já está nesse estado", 409);
    }

    const updateData: Prisma.OrderUpdateInput = {
      ...(requestedStatus !== undefined && { status: requestedStatus }),
      ...(input.shippingAddress !== undefined && {
        shippingAddress: mergeShippingAddress(
          existingOrder.shippingAddress,
          input.shippingAddress,
        ),
      }),
      ...(input.paymentMethod !== undefined && {
        paymentMethod: input.paymentMethod,
      }),
    };

    let updatedItems: Array<{ productId: number; quantity: number }> =
      existingOrder.items;
    let reservationStatus = existingOrder.stockReservationStatus;

    if (input.items !== undefined) {
      const { items, subtotal } = await prepareOrderItems(transaction, {
        items: input.items,
      }, existingOrder.stockReservationStatus === "RESERVED"
        ? existingOrder.items
        : []);
      updatedItems = items;

      if (existingOrder.stockReservationStatus === "RESERVED") {
        await adjustReservedItems(transaction, existingOrder.items, items);
      } else if (existingOrder.stockReservationStatus === "RELEASED") {
        await reserveItems(transaction, items);
        updateData.stockReservationStatus = "RESERVED";
        reservationStatus = "RESERVED";
      } else {
        throw new OrderServiceError(
          "Não é possível alterar itens de um pedido com estoque consumido",
          409,
        );
      }

      const shippingCost = existingOrder.shippingCost ?? new Prisma.Decimal(0);
      updateData.total = subtotal.plus(shippingCost);
      updateData.items = {
        deleteMany: {},
        create: items,
      };
      if (existingOrder.stockReservationStatus === "RELEASED") {
        updateData.reservationExpiresAt = new Date(
          Date.now() + RESERVATION_DURATION_MS,
        );
      }
    }

    if (requestedStatus === "PAID") {
      if (existingOrder.stockReservationStatus !== "RESERVED") {
        throw new OrderServiceError(
          "O pedido não possui uma reserva de estoque válida",
          409,
        );
      }
      updateData.paymentStatus = "SUCCEEDED";
      updateData.stockReservationStatus = "CONSUMED";
      updateData.reservationExpiresAt = null;
    }

    if (requestedStatus === "CANCELLED") {
      if (reservationStatus === "RESERVED") {
        await releaseItems(transaction, updatedItems);
        updateData.stockReservationStatus = "RELEASED";
        updateData.reservationExpiresAt = null;
      }
    }

    return transaction.order.update({
      where: { id: existingOrder.id },
      data: updateData,
      ...publicOrderDetails,
    });
  });

export const recordPaymentSession = async (
  orderId: number,
  paymentSessionId: string,
) =>
  prisma.$transaction(async (transaction) => {
    await lockOrder(transaction, orderId);

    const order = await transaction.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentSessionId: true,
        paymentStatus: true,
        stockReservationStatus: true,
        status: true,
        reservationExpiresAt: true,
      },
    });
    if (!order) throw new OrderServiceError("Pedido não encontrado", 404);
    if (
      order.paymentStatus === "PROCESSING" &&
      order.paymentSessionId === paymentSessionId
    ) {
      return order;
    }
    if (
      order.status !== "PENDING" ||
      order.paymentStatus !== "NOT_STARTED" ||
      order.stockReservationStatus !== "RESERVED" ||
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= new Date()
    ) {
      throw new OrderServiceError(
        "O pedido não pode iniciar uma sessão de pagamento",
        409,
      );
    }

    return transaction.order.update({
      where: { id: orderId },
      data: {
        paymentSessionId,
        paymentStatus: "PROCESSING",
      },
      select: {
        id: true,
        paymentSessionId: true,
        paymentStatus: true,
        stockReservationStatus: true,
        status: true,
        reservationExpiresAt: true,
      },
    });
  });

export const confirmOrderPayment = async (paymentSessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { paymentSessionId },
      select: { id: true },
    });
    if (!order) throw new OrderServiceError("Sessão de pagamento não encontrada", 404);

    await lockOrder(transaction, order.id);
    const lockedOrder = await transaction.order.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        stockReservationStatus: true,
      },
    });
    if (!lockedOrder) throw new OrderServiceError("Pedido não encontrado", 404);
    if (
      lockedOrder.paymentStatus === "SUCCEEDED" &&
      lockedOrder.stockReservationStatus === "CONSUMED"
    ) {
      return lockedOrder;
    }
    if (
      !["PROCESSING", "FAILED"].includes(lockedOrder.paymentStatus) ||
      lockedOrder.stockReservationStatus !== "RESERVED"
    ) {
      throw new OrderServiceError(
        "O pagamento não corresponde a uma reserva ativa",
        409,
      );
    }

    return transaction.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "SUCCEEDED",
        stockReservationStatus: "CONSUMED",
        reservationExpiresAt: null,
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        stockReservationStatus: true,
      },
    });
  });

export const markOrderPaymentFailed = async (paymentSessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { paymentSessionId },
      select: { id: true },
    });
    if (!order) throw new OrderServiceError("Sessão de pagamento não encontrada", 404);

    await lockOrder(transaction, order.id);
    const updated = await transaction.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: "PROCESSING",
        stockReservationStatus: "RESERVED",
      },
      data: { paymentStatus: "FAILED" },
    });
    if (updated.count === 0) {
      const current = await transaction.order.findUnique({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      if (current?.paymentStatus === "FAILED") return current;
      throw new OrderServiceError(
        "O pagamento não está em processamento",
        409,
      );
    }

    return transaction.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { id: true, paymentStatus: true },
    });
  });

export const markOrderPaymentExpired = async (paymentSessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { paymentSessionId },
      select: { id: true },
    });
    if (!order) throw new OrderServiceError("Sessão de pagamento não encontrada", 404);

    await lockOrder(transaction, order.id);
    const updated = await transaction.order.updateMany({
      where: {
        id: order.id,
        status: { in: [...EXPIRABLE_ORDER_STATUSES] },
        paymentStatus: { in: ["PROCESSING", "FAILED"] },
        stockReservationStatus: "RESERVED",
      },
      data: { paymentStatus: "EXPIRED" },
    });
    if (updated.count === 0) {
      const current = await transaction.order.findUnique({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      if (current?.paymentStatus === "EXPIRED") return current;
      throw new OrderServiceError(
        "A sessão não pode ser marcada como expirada nesse estado",
        409,
      );
    }

    return transaction.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { id: true, paymentStatus: true },
    });
  });

export const expireOrderReservations = async (
  now = new Date(),
  batchSize = 100,
) => {
  const candidates = await prisma.order.findMany({
    where: {
      status: { in: [...EXPIRABLE_ORDER_STATUSES] },
      paymentStatus: { in: [...EXPIRABLE_PAYMENT_STATUSES] },
      stockReservationStatus: "RESERVED",
      reservationExpiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: { reservationExpiresAt: "asc" },
    take: batchSize,
  });
  let expiredCount = 0;

  for (const { id } of candidates) {
    const wasExpired = await prisma.$transaction(async (transaction) => {
      await lockOrder(transaction, id);
      const order = await transaction.order.findFirst({
        where: {
          id,
          status: { in: [...EXPIRABLE_ORDER_STATUSES] },
          paymentStatus: { in: [...EXPIRABLE_PAYMENT_STATUSES] },
          stockReservationStatus: "RESERVED",
          reservationExpiresAt: { lte: now },
        },
        select: {
          id: true,
          paymentStatus: true,
          items: { select: { productId: true, quantity: true } },
        },
      });
      if (!order) return false;

      const released = await transaction.order.updateMany({
        where: {
          id: order.id,
          status: { in: [...EXPIRABLE_ORDER_STATUSES] },
          paymentStatus: { in: [...EXPIRABLE_PAYMENT_STATUSES] },
          stockReservationStatus: "RESERVED",
          reservationExpiresAt: { lte: now },
        },
        data: {
          status: "CANCELLED",
          paymentStatus:
            order.paymentStatus === "NOT_STARTED" ? "EXPIRED" : order.paymentStatus,
          stockReservationStatus: "RELEASED",
          reservationExpiresAt: null,
        },
      });
      if (released.count === 0) return false;

      const quantities = aggregateItemsByProduct(order.items);
      for (const [productId, quantity] of quantities) {
        await changeProductStock(transaction, productId, -quantity);
      }
      return true;
    });

    if (wasExpired) expiredCount += 1;
  }

  return expiredCount;
};

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const isValidOrderTransition = (current: OrderStatus, next: OrderStatus) =>
  validTransitions[current].includes(next);

export const getOrders = ({ userId, isAdmin }: OrderAccess) =>
  prisma.order.findMany({
    where: isAdmin ? {} : { userId },
    ...publicOrderDetails,
    orderBy: { createdAt: "desc" },
  });

export const getOrderById = (id: number, { userId, isAdmin }: OrderAccess) =>
  prisma.order.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId }),
    },
    ...publicOrderDetails,
  });
