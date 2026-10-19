// Require the framework and instantiate it

// ESM
import Fastify, { FastifyError } from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes";
import categoriesRoutes from "./routes/categories.routes";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes";
import ordersRoutes from "./routes/orders.routes";
import { errorHandler } from "./middlewares/error.middleware";
import fastifyCookie from "@fastify/cookie";

const PORT = parseInt(process.env.PORT ?? "3000");

const fastify = Fastify({
  logger: true,
});

//permite manipular cookies nas requisições
fastify.register(fastifyCookie);

fastify.register(jwt, {
  secret: process.env.JWT_SECRET!,
  cookie: {
    cookieName: "syntaxwear.token",
    signed: false, // Não estamos usando cookies assinados
  }
});

fastify.register(cors, {
  origin: true,
  credentials: true,
});

fastify.register(helmet, {
  contentSecurityPolicy: false,
});

fastify.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "Syntax Wear API",
      description: "API para o e-commerce Syntax Wear",
      version: "1.0.0",
    },
    servers: [],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Autenticação via token JWT",
        },
      },
    },
  },
});

fastify.register(scalar, {
  routePrefix: "/api-docs",
  configuration: {
    theme: "default",
  },
});

fastify.register(productRoutes, { prefix: "/products" });
fastify.register(categoriesRoutes, { prefix: "/categories" });
fastify.register(authRoutes, { prefix: "/auth" });
fastify.register(ordersRoutes, { prefix: "/orders" });

// Declare a route
fastify.get("/", async (request, reply) => {
  return {
    message: "E-commerce Syntax",
    version: "1.0.0",
    status: "running",
  };
});

fastify.get("/health", async (request, reply) => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

fastify.setErrorHandler(errorHandler);

export default fastify;
