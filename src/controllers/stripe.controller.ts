import type { FastifyReply, FastifyRequest } from "fastify";
import {
  assertOrderCanStartCheckout,
  createOrder,
  normalizeIdempotencyKey,
  OrderServiceError,
  recordPaymentSession,
} from "../services/orders.service";
import {
  createStripeCheckoutService,
  validateStripeCheckoutConfiguration,
} from "../services/stripe.service";
import type { CreateOrder } from "../types";
import { createOrderSchema } from "../utils/validators";

export class StripeController {
  async createCheckoutSession(
    request: FastifyRequest<{ Body: CreateOrder }>,
    reply: FastifyReply,
  ) {
    const data = createOrderSchema.parse(request.body);
    const requestIdempotencyKey = request.headers["idempotency-key"];

    if (typeof requestIdempotencyKey !== "string") {
      return reply.status(400).send({
        message: "Header Idempotency-Key é obrigatório",
      });
    }

    try {
      const idempotencyKey = normalizeIdempotencyKey(requestIdempotencyKey);
      validateStripeCheckoutConfiguration();
      const order = await createOrder(request.user.userId, data, idempotencyKey);
      await assertOrderCanStartCheckout(order.id, request.user.userId);

      const { sessionId } = await createStripeCheckoutService({
        userId: request.user.userId,
        idempotencyKey,
        products: order.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        shippingCost: order.shippingCost ?? 0,
      });

      await recordPaymentSession(order.id, sessionId);

      return reply.status(200).send({ sessionId });
    } catch (error) {
      if (error instanceof OrderServiceError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  }
}
