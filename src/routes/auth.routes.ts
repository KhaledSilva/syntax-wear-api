import { FastifyInstance } from "fastify";
import { register } from "../controllers/auth.controller";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/",
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
}
