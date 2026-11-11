import z from "zod";
import { Prisma } from "@prisma/client";

export const loginSchema = z.object({
    email: z.email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  });

export const registerSchema = z.object({
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  cpf: z.string().optional(),
  birthDate: z.string().optional(),
  phone: z.string().optional(),
});

const queryNumber = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/, "Deve ser um número válido")
  .transform(Number)
  .pipe(z.number().finite().nonnegative());

const queryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const productFiltersSchema = z
  .object({
    page: z
      .string()
      .regex(/^\d+$/, "Página deve ser um número inteiro")
      .transform(Number)
      .pipe(z.number().int().min(1, "Página deve ser maior que zero"))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limite deve ser um número inteiro")
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional(),
    categoryId: z
      .string()
      .regex(/^\d+$/, "ID da categoria deve ser um número inteiro")
      .transform(Number)
      .pipe(z.number().int().positive())
      .optional(),
    minPrice: queryNumber.optional(),
    maxPrice: queryNumber.optional(),
    search: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    active: queryBoolean.optional(),
    inStock: queryBoolean.optional(),
    sortBy: z.enum(["price", "name", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      message: "Preço mínimo não pode ser maior que o preço máximo",
      path: ["maxPrice"],
    },
  );

const productPriceSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Preço deve ser uma string decimal com até duas casas")
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.greaterThan(0), "Preço deve ser um número positivo");

export const createProductSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().min(1, "Descrição é obrigatória"),
    price: productPriceSchema,
    categoryId: z.number().int().positive("Categoria inválida"),
    colors: z.array(z.string()).optional(),
    sizes: z.array(z.string()).optional(),
    slug: z.string().min(1, "Slug é obrigatório"),
    stock: z.number().int().nonnegative("Estoque deve ser um número inteiro não negativo"),
    active: z.boolean(),
    images: z.array(z.string()).optional(),
  });

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  description: z.string().nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  slug: z.string().min(1, "Slug é obrigatório").optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const deleteCategorySchema = z.object({
  id: z.number().int().min(1, "ID inválido"),
});

  export const updateProductSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").optional(),
    description: z.string().min(1, "Descrição é obrigatória").optional(),
    price: productPriceSchema.optional(),
    categoryId: z.number().int().positive("Categoria inválida").optional(),
    colors: z.array(z.string()).optional(),
    sizes: z.array(z.string()).optional(),
    slug: z.string().min(1, "Slug é obrigatório").optional(),
    stock: z.number().int().nonnegative("Estoque deve ser um número inteiro não negativo").optional(),
    active: z.boolean().optional(),
    images: z.array(z.string()).optional(),
  });

  export const deleteProductSchema = z.object({
    id: z.number().int().min(1, "ID inválido"),
  });

  export const orderIdSchema = z.object({
    id: z.coerce.number().int().positive("ID do pedido inválido"),
  });

  const addressNumberStringSchema = z
    .string()
    .trim()
    .min(1, "Número do endereço é obrigatório")
    .max(100, "Número do endereço excede o limite permitido")
    .regex(
      /^[\p{L}\p{N}]+(?:[./ -][\p{L}\p{N}]+)*$/u,
      "Número do endereço inválido",
    )
    .refine(
      (value) => /\p{N}/u.test(value) || /^s\/?n$/iu.test(value),
      "Número do endereço deve conter números ou ser S/N",
    );

  const addressNumberSchema = z
    .union([
      addressNumberStringSchema,
      z.number().finite().positive("Número do endereço inválido"),
    ])
    .transform(String);

  export const createOrderSchema = z
    .object({
      items: z
        .array(
          z
            .object({
              productId: z
                .number()
                .int()
                .positive("Produto inválido")
                .max(2_147_483_647, "Produto inválido"),
              quantity: z
                .number()
                .int()
                .positive("Quantidade deve ser um inteiro positivo")
                .max(2_147_483_647, "Quantidade excede o limite permitido"),
              size: z.string().min(1, "Tamanho é obrigatório"),
            })
            .strict(),
        )
        .min(1, "O pedido deve conter ao menos um item"),
      shippingAddress: z
        .object({
          cep: z.string().trim().min(1, "CEP é obrigatório").max(20),
          street: z.string().trim().min(1, "Rua é obrigatória").max(200),
          number: addressNumberSchema,
          complement: z.string().trim().max(200).optional(),
          neighborhood: z.string().trim().min(1, "Bairro é obrigatório").max(100),
          city: z.string().trim().min(1, "Cidade é obrigatória").max(100),
          state: z.string().trim().min(1, "Estado é obrigatório").max(100),
        })
        .strict(),
      paymentMethod: z.string().trim().min(1, "Método de pagamento é obrigatório").max(100),
      shippingCost: z
        .number()
        .finite()
        .nonnegative("Frete deve ser um valor válido e não negativo")
        .max(Number.MAX_SAFE_INTEGER / 100, "Frete excede o limite permitido"),
    })
    .strict();

  export const updateOrderSchema = z
    .object({
      status: z.enum(["PENDING", "CONFIRMED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
      items: createOrderSchema.shape.items.optional(),
      shippingAddress: createOrderSchema.shape.shippingAddress
        .partial()
        .strict()
        .optional(),
      paymentMethod: createOrderSchema.shape.paymentMethod.optional(),
    })
    .strict()
    .refine(
      ({ status, items, shippingAddress, paymentMethod }) =>
        status !== undefined ||
        items !== undefined ||
        shippingAddress !== undefined ||
        paymentMethod !== undefined,
      { message: "Informe ao menos um campo para atualizar o pedido" },
    );