import { FastifyInstance } from "fastify";
import { login, register } from "../controllers/auth.controller";

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
            email: { type: "string", format: "email", description: "Email do usuário" },
            password: { type: "string", minLength: 8, description: "Senha do usuário (mínimo de 8 caracteres)" },
            cpf: { type: "string", description: "CPF do usuário (opcional)" },
            birthDate: { type: "string", format: "date", description: "Data de nascimento do usuário (YYYY-MM-DD) (opcional)" },
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
            email: { type: "string", format: "email", description: "Email do usuário" },
            password: { type: "string", minLength: 6, description: "Senha do usuário (mínimo de 6 caracteres)" },
          },
        },
      },
    },
    login,
  );
}
