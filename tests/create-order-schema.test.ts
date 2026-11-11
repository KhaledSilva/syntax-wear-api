import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../src/utils/validators";

const createOrderPayload = (number: string | number) => ({
  items: [{ productId: 5, quantity: 1, size: "M" }],
  shippingAddress: {
    cep: "01001-000",
    street: "Praça da Sé",
    number,
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
  },
  paymentMethod: "credit_card",
  shippingCost: 14.9,
});

describe("createOrderSchema - número do endereço", () => {
  it.each(["S/N", "125-A", "1024"])("aceita o número de endereço %s", (number) => {
    const parsed = createOrderSchema.parse(createOrderPayload(number));

    expect(parsed.shippingAddress.number).toBe(number);
  });

  it("converte números recebidos por clientes antigos para string", () => {
    const parsed = createOrderSchema.parse(createOrderPayload(1024));

    expect(parsed.shippingAddress.number).toBe("1024");
  });

  it.each(["", "---", "abc", "S/N!"])(
    "rejeita o valor inválido %j",
    (number) => {
      expect(() =>
        createOrderSchema.parse(createOrderPayload(number)),
      ).toThrow();
    },
  );

  it.each([0, -1, Number.POSITIVE_INFINITY])(
    "rejeita o valor numérico inválido %s",
    (number) => {
      expect(() =>
        createOrderSchema.parse(createOrderPayload(number)),
      ).toThrow();
    },
  );
});
