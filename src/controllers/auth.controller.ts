import { FastifyReply, FastifyRequest } from "fastify";
import { loginUser, registerUser } from "../services/auth.service";
import { AuthRequest, RegisterRequest } from "../types";
import { loginSchema, registerSchema } from "../utils/validators";

export const register = async (
  request: FastifyRequest<{ Body: RegisterRequest }>,
  reply: FastifyReply,
) => {
  const validation = registerSchema.parse(request.body as RegisterRequest);

  const user = await registerUser(validation);

  const token = request.server.jwt.sign({ userId: user.id, role: user.role });
  reply.status(201).send({
    user,
    token,
  });
};

export const login = async (request: FastifyRequest<{Body: AuthRequest}>, reply: FastifyReply) => {

  const validation = loginSchema.parse(request.body as AuthRequest)

    const user = await loginUser(validation, reply);

    if (!user) return;

    const token = request.server.jwt.sign({ userId: user.id, role: user.role });

    reply.setCookie("syntaxwear.token", token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "lax", 
      path: "/", 
      maxAge: 60 * 60 * 24, 
    })
    reply.status(200).send({
        user,
    });
}

export const profile = async (request: FastifyRequest, reply: FastifyReply) => reply.send(request.user);