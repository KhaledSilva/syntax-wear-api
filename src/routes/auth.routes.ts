import { FastifyInstance } from "fastify";
import { googleLogin, login, profile, register, signOut } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register",
    {
      schema: {
        tags: ["Auth"],
        description: "Registra um novo usuário e retorna o token JWT",
        body: {
          type: "object",
          required: ["firstName", "lastName", "email", "password"],
          properties: {
            firstName: { type: "string", description: "Nome do usuário" },
            lastName: { type: "string", description: "Sobrenome do usuário" },
            email: { type: "string", description: "Email do usuário" },
            password: { type: "string", description: "Senha do usuário (mínimo de 8 caracteres)" },
            cpf: { type: "string", description: "CPF do usuário (opcional)" },
            birthDate: { type: "string", description: "Data de nascimento do usuário (YYYY-MM-DD) (opcional)" },
            phone: { type: "string", description: "Telefone do usuário (opcional)" },
          }
        },
      },
    },
    register,
  );

  fastify.post("/login",
    {
      schema: {
        tags: ["Auth"],
        description: "Autentica um usuário e retorna o token JWT",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", description: "Email do usuário" },
            password: { type: "string", description: "Senha do usuário" },
          },
        },
      },
    },
    login,
  );

  fastify.get("/profile", {
    preHandler: [authenticate], 
    schema: {
      tags: ["Auth"],
      description: "Retorna o perfil do usuário autenticado",
      security: [{ bearerAuth: [] }],
    },
  }, profile);

  fastify.post(
    "/google",
    {
      schema: {
        tags: ["Auth"],
        description: "Autentica um usuário via Google OAuth2 e retorna um token JWT",
        body: {
          type: "object",
          required: ["credential"],
          properties: {
            credential: { type: "string", description: "Credencial do Google" },
          },
        },
      },
    },
    googleLogin
  );

  fastify.post("/logout", {
    preHandler: [authenticate], 
    schema: {
      tags: ["Auth"],
      description: "Realiza o logout do usuário removendo o cookie JWT",
      security: [{ bearerAuth: [] }], 
    },
  }, signOut);
}
