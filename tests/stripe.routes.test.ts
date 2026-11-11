import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import stripeRoutes from "../src/routes/stripe.routes";
import { createOrder } from "../src/services/orders.service";
import { validateStripeCheckoutConfiguration } from "../src/services/stripe.service";
import { errorHandler } from "../src/middlewares/error.middleware";

vi.mock("../src/services/orders.service", () => ({
  assertOrderCanStartCheckout: vi.fn(),
  createOrder: vi.fn(),
  normalizeIdempotencyKey: vi.fn((key: string) => key),
  OrderServiceError: class OrderServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  recordPaymentSession: vi.fn(),
}));

vi.mock("../src/services/stripe.service", () => ({
  createStripeCheckoutService: vi.fn(),
  validateStripeCheckoutConfiguration: vi.fn(),
}));

describe("POST /stripe/checkout/session", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);

    await app.register(fastifyCookie);
    await app.register(jwt, {
      secret: "test-stripe-jwt-secret",
      cookie: { cookieName: "syntaxwear.token", signed: false },
    });
    await app.register(stripeRoutes, { prefix: "/stripe" });
    await app.ready();

    token = app.jwt.sign({ userId: 7, role: "USER" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("retorna os campos e mensagens de um payload inválido sem criar o pedido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/stripe/checkout/session",
      headers: {
        cookie: `syntaxwear.token=${token}`,
        "idempotency-key": "invalid-checkout-payload",
      },
      payload: {
        items: [{ productId: 5, quantity: 1 }],
        shippingAddress: {
          cep: "01001-000",
          street: "Praça da Sé",
          number: 100,
          neighborhood: "Sé",
          city: "São Paulo",
          state: "SP",
        },
        paymentMethod: "credit_card",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "Payload inválido",
      errors: expect.arrayContaining([
        {
          field: "items.0.size",
          messages: expect.arrayContaining([expect.any(String)]),
        },
        {
          field: "shippingCost",
          messages: expect.arrayContaining([expect.any(String)]),
        },
      ]),
    });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("não expõe a mensagem técnica de um erro interno do Stripe na resposta", async () => {
    vi.mocked(validateStripeCheckoutConfiguration).mockImplementationOnce(() => {
      throw Object.assign(new Error("Missing STRIPE_SUCCESS_URL"), {
        code: "ERR_STRIPE_CONFIG",
      });
    });

    const response = await app.inject({
      method: "POST",
      url: "/stripe/checkout/session",
      headers: {
        cookie: `syntaxwear.token=${token}`,
        "idempotency-key": "checkout-config-error",
      },
      payload: {
        items: [{ productId: 5, quantity: 1, size: "M" }],
        shippingAddress: {
          cep: "01001-000",
          street: "Praça da Sé",
          number: "100",
          neighborhood: "Sé",
          city: "São Paulo",
          state: "SP",
        },
        paymentMethod: "credit_card",
        shippingCost: 14.9,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: "Erro interno do servidor" });
    expect(response.body).not.toContain("STRIPE_SUCCESS_URL");
    expect(createOrder).not.toHaveBeenCalled();
  });
});
