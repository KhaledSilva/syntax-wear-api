import { FastifyRequest, FastifyReply } from "fastify";

export const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Token inválido ou expirado" });
    return;
  }
};

export const authorizeAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (request.user.role !== "ADMIN") {
    reply.status(403).send({ error: "Acesso restrito a administradores" });
  }
};

export const authorizeAdminForMutations = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    await authorizeAdmin(request, reply);
  }
};
