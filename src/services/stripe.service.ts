import "dotenv/config";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

interface OrderItem {
  id: number;
  name: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
}

interface CreateStripeCheckoutServiceRequest {
  userId: number;
  orderId: number;
  idempotencyKey: string;
  products: OrderItem[];
  shippingCost: Prisma.Decimal | number;
}

const getCheckoutUrl = (name: "STRIPE_SUCCESS_URL" | "STRIPE_CANCEL_URL") => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }

  return value;
};

export const validateStripeCheckoutConfiguration = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  getCheckoutUrl("STRIPE_SUCCESS_URL");
  getCheckoutUrl("STRIPE_CANCEL_URL");
};

const toStripeAmount = (amount: Prisma.Decimal, description: string) => {
  const amountInCents = amount.mul(100);
  const numericAmount = amountInCents.toNumber();

  if (
    !amountInCents.isInteger() ||
    !Number.isSafeInteger(numericAmount) ||
    numericAmount < 0
  ) {
    throw new Error(`${description} must be a non-negative amount with at most two decimal places`);
  }

  return numericAmount;
};

export const createStripeCheckoutService = async ({
  userId,
  orderId,
  idempotencyKey,
  products,
  shippingCost,
}: CreateStripeCheckoutServiceRequest) => {
  validateStripeCheckoutConfiguration();
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  const successUrl = getCheckoutUrl("STRIPE_SUCCESS_URL");
  const cancelUrl = getCheckoutUrl("STRIPE_CANCEL_URL");
  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
  const shipping = new Prisma.Decimal(shippingCost);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = products.map(
    (product) => ({
      price_data: {
        currency: "brl",
        unit_amount: toStripeAmount(
          product.unitPrice,
          `Preço do produto ${product.id}`,
        ),
        product_data: {
          name: product.name,
        },
      },
      quantity: product.quantity,
    }),
  );

  if (shipping.greaterThan(0)) {
    lineItems.push({
      price_data: {
        currency: "brl",
        unit_amount: toStripeAmount(shipping, "Frete"),
        product_data: { name: "Frete" },
      },
      quantity: 1,
    });
  }

  const stripeIdempotencyKey = createHash("sha256")
    .update(`orders:create:${userId}:${idempotencyKey}`)
    .digest("hex");

  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      mode: "payment",
      metadata: {
        orderId,
      },
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
    { idempotencyKey: stripeIdempotencyKey },
  );

  return { sessionId: session.id };
};
