import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { CreateOrder, OrderStatus, UpdateOrder } from "../types";

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

type OrderAccess = {
  userId: number;
  isAdmin: boolean;
};

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 403 | 404 | 409,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

const prepareOrderItems = async (
  transaction: Prisma.TransactionClient,
  data: Pick<CreateOrder, "items">,
) => {
  const products = await transaction.product.findMany({
    where: {
      id: { in: data.items.map(({ productId }) => productId) },
    },
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
  const missingProductId = data.items.find(({ productId }) => !productsById.has(productId))?.productId;

  if (missingProductId !== undefined) {
    throw new OrderServiceError(`Produto ${missingProductId} não encontrado`, 404);
  }

  const items = data.items.map(({ productId, quantity, size }) => {
    const product = productsById.get(productId);

    if (!product) {
      throw new OrderServiceError(`Produto ${productId} não encontrado`, 404);
    }

    if (!product.active) {
      throw new OrderServiceError(`Produto ${productId} está inativo`, 409);
    }

    if (product.stock < quantity) {
      throw new OrderServiceError(`Estoque insuficiente para o produto ${productId}`, 409);
    }

    if (!Array.isArray(product.sizes) || !product.sizes.includes(size)) {
      throw new OrderServiceError(`Tamanho ${size} indisponível para o produto ${productId}`, 409);
    }

    return {
      productId,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      size,
    };
  });

  const total = items.reduce(
    (sum, item) => sum.plus(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

  return { items, total };
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
});

export const createOrder = async (userId: number, data: CreateOrder) =>
  prisma.$transaction(async (transaction) => {
    const { items, total } = await prepareOrderItems(transaction, data);
    return transaction.order.create({
      data: {
        userId,
        total,
        ...orderData(data),
        items: {
          create: items,
        },
      },
      include: orderDetails,
    });
  });

export const updateOrder = async (
  id: number,
  access: OrderAccess,
  input: UpdateOrder,
) =>
  prisma.$transaction(async (transaction) => {
    const existingOrder = await transaction.order.findFirst({
      where: {
        id,
        ...(access.isAdmin ? {} : { userId: access.userId }),
      },
      select: { id: true, status: true, shippingAddress: true },
    });

    if (!existingOrder) {
      throw new OrderServiceError("Pedido não encontrado", 404);
    }

    const hasOrderData =
      input.items !== undefined ||
      input.shippingAddress !== undefined ||
      input.paymentMethod !== undefined;
    const requestedStatus = input.status;

    if (hasOrderData && existingOrder.status !== "PENDING") {
      throw new OrderServiceError("Somente pedidos pendentes podem ser atualizados", 409);
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

    if (input.items !== undefined) {
      const { items, total } = await prepareOrderItems(transaction, {
        items: input.items,
      });
      Object.assign(updateData, {
        total,
        items: {
          deleteMany: {},
          create: items,
        },
      });
    }

    return transaction.order.update({
      where: { id: existingOrder.id },
      data: updateData,
      include: orderDetails,
    });
  });

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
    include: orderDetails,
    orderBy: { createdAt: "desc" },
  });

export const getOrderById = (id: number, { userId, isAdmin }: OrderAccess) =>
  prisma.order.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId }),
    },
    include: orderDetails,
  });
