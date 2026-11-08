import type { FastifyInstance } from "fastify";
import { StripeController } from "../controllers/stripe.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { CreateOrder } from "../types";

const stripeController = new StripeController();

export default async function stripeRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: CreateOrder;
    Headers: { "idempotency-key": string };
  }>(
    "/checkout/session",
    { preHandler: authenticate },
    (request, reply) => stripeController.createCheckoutSession(request, reply),
  );
}
