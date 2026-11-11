import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createProductSchema, updateProductSchema } from "../src/utils/validators";

const productPayload = {
  name: "Produto de teste",
  description: "Descrição do produto",
  price: "89.90",
  categoryId: 1,
  slug: "produto-de-teste",
  stock: 1,
  active: true,
};

describe("validação de preço de produto", () => {
  it("converte uma string decimal diretamente para Prisma.Decimal", () => {
    const parsed = createProductSchema.parse(productPayload);

    expect(parsed.price).toBeInstanceOf(Prisma.Decimal);
    expect(parsed.price.toString()).toBe("89.9");
    expect(parsed.price.mul(100).toString()).toBe("8990");
  });

  it.each(["89.901", "1e2", "0", "-1", "abc"])(
    "rejeita preço inválido %s",
    (price) => {
      expect(() =>
        createProductSchema.parse({ ...productPayload, price }),
      ).toThrow();
    },
  );

  it("não aceita preço JSON numérico", () => {
    expect(() =>
      createProductSchema.parse({ ...productPayload, price: 89.9 }),
    ).toThrow();
  });

  it("aplica a mesma conversão decimal durante atualização", () => {
    const parsed = updateProductSchema.parse({ price: "29.99" });

    expect(parsed.price).toBeInstanceOf(Prisma.Decimal);
    expect(parsed.price?.mul(100).toString()).toBe("2999");
  });
});
