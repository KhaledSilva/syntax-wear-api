import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: number;
      role?: "USER" | "ADMIN";
    };
    user: {
      userId: number;
      role?: "USER" | "ADMIN";
    };
  }
}
