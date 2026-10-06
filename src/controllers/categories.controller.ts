import { FastifyReply, FastifyRequest } from "fastify";
import {
  createCategory as createCategory,
  getCategories as findCategories,
  getCategoryById as findCategoryById,
} from "../services/categories.service";
import { CreateCategory } from "../types";
import { createCategorySchema } from "../utils/validators";
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
