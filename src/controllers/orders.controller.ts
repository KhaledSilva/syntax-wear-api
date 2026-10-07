import { FastifyReply, FastifyRequest } from "fastify";
import { CreateOrder, UpdateOrder } from "../types";
import {
  createOrder,
  getOrderById,
  getOrders,
  OrderServiceError,
  updateOrder,
} from "../services/orders.service";
import { createOrderSchema, orderIdSchema, updateOrderSchema } from "../utils/validators";

const orderAccess = (request: FastifyRequest) => ({
  userId: request.user.userId,
  isAdmin: request.user.role === "ADMIN",
});

export const createNewOrder = async (
  request: FastifyRequest<{ Body: CreateOrder }>,
  reply: FastifyReply,
) => {
  const data = createOrderSchema.parse(request.body);

  try {
    const order = await createOrder(request.user.userId, data);
    return reply.status(201).send(order);
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    throw error;
  }
};

export const updateExistingOrder = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateOrder;
  }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);
  const data = updateOrderSchema.parse(request.body);

  try {
    const order = await updateOrder(id, orderAccess(request), data);
    return reply.status(200).send(order);
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    throw error;
  }
};

export const cancelOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);

  try {
    const order = await updateOrder(id, orderAccess(request), { status: "CANCELLED" });
    return reply.status(200).send(order);
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return reply.status(error.statusCode).send({ message: error.message });
    }
    throw error;
  }
};

export const listOrders = async (request: FastifyRequest, reply: FastifyReply) => {
  const orders = await getOrders(orderAccess(request));

  reply.status(200).send(orders);
};

export const getOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);
  const order = await getOrderById(id, orderAccess(request));

  if (!order) {
    return reply.status(404).send({ message: "Pedido não encontrado" });
  }

  return reply.status(200).send(order);
};
