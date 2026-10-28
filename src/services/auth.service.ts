import { FastifyReply } from "fastify";
import { AuthRequest, RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";

export const registerUser = async (
  paylaod: RegisterRequest,
  reply: FastifyReply,
) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: paylaod.email }, { cpf: paylaod.cpf }],
    },
  });

  if (existingUser) {
    if (existingUser.email === paylaod.email) {
      return reply.status(409).send({ message: "E-mail já cadastrado" });
    }

    if (existingUser.cpf === paylaod.cpf) {
      return reply.status(409).send({ message: "CPF já cadastrado" });
    }
  }

  const hashedPassword = await bcrypt.hash(paylaod.password, 10);

  const newUser = await prisma.user.create({
    data: {
      firstName: paylaod.firstName,
      lastName: paylaod.lastName,
      email: paylaod.email,
      password: hashedPassword,
      cpf: paylaod.cpf,
      birthDate: paylaod.birthDate ? new Date(paylaod.birthDate) : undefined,
      phone: paylaod.phone,
      role: "USER",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      cpf: true,
      birthDate: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return newUser;
};

export const loginUser = async (data: AuthRequest, reply: FastifyReply) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    reply.status(409).send({ message: "As credenciais estão incorretas." });
    return;
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);

  if (!isPasswordValid) {
    reply.status(409).send({ message: "As credenciais estão incorretas." });
    return;
  }

  const { password, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const loginWithGoogle = async (
  credential: string,
  reply: FastifyReply,
) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    reply.status(401).send({ message: "Token do Google inválido" });
    return;
  }

  const { email, given_name, family_name } = payload;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        firstName: given_name || "",
        lastName: family_name || "",
        email,
        password: "",
        role: "USER",
      },
    });
  }

  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};
