import { FastifyReply, FastifyRequest } from "fastify";
import { getOrderById, getOrders } from "../services/orders.service";
import { orderIdSchema } from "../utils/validators";

export const listOrders = async (request: FastifyRequest, reply: FastifyReply) => {
  const orders = await getOrders({
    userId: request.user.userId,
    isAdmin: request.user.role === "ADMIN",
  });

  reply.status(200).send(orders);
};

export const getOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);
  const order = await getOrderById(id, {
    userId: request.user.userId,
    isAdmin: request.user.role === "ADMIN",
  });

  if (!order) {
    return reply.status(404).send({ message: "Pedido não encontrado" });
  }

  return reply.status(200).send(order);
};
