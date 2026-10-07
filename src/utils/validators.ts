import z from "zod";

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

export const createProductSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().min(1, "Descrição é obrigatória"),
    price: z.number().positive("Preço deve ser um número positivo"),
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
    price: z.number().positive("Preço deve ser um número positivo").optional(),
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

  export const createOrderSchema = z
    .object({
      items: z
        .array(
          z
            .object({
              productId: z.number().int().positive("Produto inválido"),
              quantity: z.number().int().positive("Quantidade deve ser um inteiro positivo"),
              size: z.string().min(1, "Tamanho é obrigatório"),
            })
            .strict(),
        )
        .min(1, "O pedido deve conter ao menos um item"),
      shippingAddress: z
        .object({
          cep: z.string().trim().min(1, "CEP é obrigatório").max(20),
          street: z.string().trim().min(1, "Rua é obrigatória").max(200),
          number: z.string().trim().min(1, "Número é obrigatório").max(30),
          complement: z.string().trim().max(200).optional(),
          neighborhood: z.string().trim().min(1, "Bairro é obrigatório").max(100),
          city: z.string().trim().min(1, "Cidade é obrigatória").max(100),
          state: z.string().trim().min(1, "Estado é obrigatório").max(100),
          country: z.string().trim().min(1, "País é obrigatório").max(100),
        })
        .strict(),
      paymentMethod: z.string().trim().min(1, "Método de pagamento é obrigatório").max(100),
    })
    .strict()
    .superRefine(({ items }, context) => {
      const productIds = new Set<number>();
      items.forEach(({ productId }, index) => {
        if (productIds.has(productId)) {
          context.addIssue({
            code: "custom",
            message: "Cada produto deve aparecer uma única vez no pedido",
            path: ["items", index, "productId"],
          });
        }
        productIds.add(productId);
      });
    });

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
    )
    .superRefine(({ items }, context) => {
      if (!items) return;

      const productIds = new Set<number>();
      items.forEach(({ productId }, index) => {
        if (productIds.has(productId)) {
          context.addIssue({
            code: "custom",
            message: "Cada produto deve aparecer uma única vez no pedido",
            path: ["items", index, "productId"],
          });
        }
        productIds.add(productId);
      });
    });