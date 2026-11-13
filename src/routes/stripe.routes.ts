import type { FastifyInstance } from "fastify";
import { StripeController } from "../controllers/stripe.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { CreateOrder } from "../types";
import { StripeWebhookController } from "../controllers/stripe-webhook.controller";
import fastityRawBody from "fastify-raw-body";

const stripeController = new StripeController();
const stripeWebhookController = new StripeWebhookController();

export default async function stripeRoutes(fastify: FastifyInstance) {

  await fastify.register(fastityRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });

  fastify.post<{
    Body: CreateOrder;
    Headers: { "idempotency-key": string };
  }>(
    "/checkout/session",
    { preHandler: authenticate },
    (request, reply) => stripeController.createCheckoutSession(request, reply),
  );

  fastify.post(
    "/webhook", {
      config: {
        rawBody: true
      }
    },
     stripeWebhookController.handle.bind(stripeWebhookController));
}
