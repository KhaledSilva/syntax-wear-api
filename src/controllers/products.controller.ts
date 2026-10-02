import { FastifyReply, FastifyRequest } from "fastify";
import { getProducts, getProductById } from "../services/products.service";
import { productListQuerySchema } from "../utils/validators";

export const listProducts = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const filters = productListQuerySchema.parse(request.query);

  const result = await getProducts(filters);
  reply.status(200).send(result);
};

export const getProduct = async (
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply) => {
  const product = await getProductById(request.params.id);
  reply.status(200).send(product);
};
