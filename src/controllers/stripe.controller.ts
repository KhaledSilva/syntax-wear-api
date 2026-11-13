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
import { ZodError } from "zod";

const formatValidationErrors = (error: ZodError) => {
  const fieldErrors = new Map<string, string[]>();

  for (const issue of error.issues) {
    const path = issue.path.map(String);
    const fields =
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => [...path, key].join("."))
        : [path.join(".") || "body"];

    for (const field of fields) {
      const messages = fieldErrors.get(field) ?? [];
      messages.push(issue.message);
      fieldErrors.set(field, messages);
    }
  }

  return [...fieldErrors].map(([field, messages]) => ({ field, messages }));
};

const getSafeErrorDetails = (error: unknown) => {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      code: undefined,
      message: "Erro não-Error durante o checkout",
    };
  }

  const code =
    "code" in error &&
    (typeof error.code === "string" || typeof error.code === "number")
      ? error.code
      : undefined;
  const message = error.message
    .replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+/g, "[chave Stripe omitida]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [credencial omitida]")
    .replace(
      /(["']?(?:authorization|cookie|set-cookie|token|secret|password|email|shippingAddress|address|street|number|cep|neighborhood|city|state)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s}]+)/gi,
      "$1[valor omitido]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitido]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL omitida]")
    .slice(0, 1000);

  return { name: error.name, code, message };
};

export class StripeController {
  async createCheckoutSession(
    request: FastifyRequest<{ Body: CreateOrder }>,
    reply: FastifyReply,
  ) { 
    let data: CreateOrder;
    try {
      data = createOrderSchema.parse(request.body);
    } catch (error) {
      if (!(error instanceof ZodError)) {
        throw error;
      }

      return reply.status(400).send({
        message: "Payload inválido",
        errors: formatValidationErrors(error),
      });
    }

    const requestIdempotencyKey = request.headers["idempotency-key"];

    if (typeof requestIdempotencyKey !== "string") {
      return reply.status(400).send({
        message: "Header Idempotency-Key é obrigatório",
      });
    }

    let checkoutStage = "normalização da chave de idempotência";
    try {
      const idempotencyKey = normalizeIdempotencyKey(requestIdempotencyKey);
      checkoutStage = "validação da configuração Stripe";
      validateStripeCheckoutConfiguration();
      checkoutStage = "criação do pedido";
      const order = await createOrder(request.user.userId, data, idempotencyKey);
      checkoutStage = "validação do pedido para checkout";
      await assertOrderCanStartCheckout(order.id, request.user.userId);
      checkoutStage = "criação da sessão Stripe";
      const { sessionId } = await createStripeCheckoutService({
        userId: request.user.userId,
        orderId: order.id,
        idempotencyKey,
        products: order.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        shippingCost: order.shippingCost ?? 0,
      });

      checkoutStage = "persistência do sessionId no pedido";
      await recordPaymentSession(order.id, sessionId);

      return reply.status(200).send({ sessionId });
    } catch (error) {
      if (error instanceof OrderServiceError) {
        return reply.status(error.statusCode).send({ message: error.message });
      }

      request.log.error(
        {
          checkoutStage,
          error: getSafeErrorDetails(error),
        },
        "Falha técnica no checkout Stripe",
      );
      throw error;
    }
  }
}
