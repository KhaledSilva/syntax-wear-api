import { FastifyReply, FastifyRequest } from "fastify";
import {
  createCategory as createCategory,
  deleteCategory as removeCategory,
  getCategories as findCategories,
  getCategoryById as findCategoryById,
  updateCategory as updateCategory,
} from "../services/categories.service";
import { CreateCategory, UpdateCategory } from "../types";
import {
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "../utils/validators";
import slugify from "slugify";

export const getCategories = async (_request: FastifyRequest, reply: FastifyReply) => {
  const categories = await findCategories();
  reply.status(200).send(categories);
};

export const getCategoryById = async (
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply,
) => {
  const category = await findCategoryById(request.params.id);
  reply.status(200).send(category);
};

export const createNewCategory = async (
  request: FastifyRequest<{ Body: CreateCategory }>,
  reply: FastifyReply,
) => {
  const body = request.body;
  body.slug = slugify(body.name, {
    lower: true,
    strict: true,
    locale: "pt",
  });

  const validatedCategory = createCategorySchema.parse(body);
  await createCategory(validatedCategory);

  reply.status(201).send({ message: "Categoria criada com sucesso" });
};

export const updateExistingCategory = async (
  request: FastifyRequest<{ Params: { id: number }; Body: UpdateCategory }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;
  const validatedCategory = updateCategorySchema.parse(request.body);

  if (validatedCategory.name) {
    validatedCategory.slug = slugify(validatedCategory.name, {
      lower: true,
      strict: true,
      locale: "pt",
    });
  }

  const category = await updateCategory(id, validatedCategory);
  reply.status(200).send(category);
};

export const deleteExistingCategory = async (
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply,
) => {
  const validatedParams = deleteCategorySchema.parse(request.params);
  await removeCategory(validatedParams.id);

  reply.status(200).send({ message: "Categoria desativada com sucesso" });
};
