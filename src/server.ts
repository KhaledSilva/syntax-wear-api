import fastify from "./app";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const start = async () => {
  try {
    const address = await fastify.listen({ port, host });
    fastify.log.info(`Servidor iniciado em ${address}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

void start();
