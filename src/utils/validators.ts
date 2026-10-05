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