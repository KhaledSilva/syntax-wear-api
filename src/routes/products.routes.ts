import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/products.controller";

export default async function productsRoutes(fastify: FastifyInstance) {
    fastify.get("/", listProducts);
}