import { FastifyReply, FastifyRequest } from "fastify";
import {
  getCategories as findCategories,
  getCategoryById as findCategoryById,
} from "../services/categories.service";

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
