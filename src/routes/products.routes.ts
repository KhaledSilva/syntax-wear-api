import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/products.controller";
import { authenticate } from "../middlewares/auth.middleware";

export default async function productsRoutes(fastify: FastifyInstance) {
    fastify.addHook("onRequest", authenticate);
    fastify.get("/", listProducts);
}