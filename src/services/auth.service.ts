import { AuthRequest, RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";

export const registerUser = async (paylaod: RegisterRequest) => {
    const birthDate = paylaod.birthDate ? new Date(paylaod.birthDate) : undefined;

    const existingUser = await prisma.user.findUnique({
        where: { email: paylaod.email },
    });

    if (existingUser) {
        throw new Error("Email já cadastrado");
    }

    const hashedPassword = await bcrypt.hash(paylaod.password, 10);

    const newUser = await prisma.user.create({
        data: {
            firstName: paylaod.firstName,
            lastName: paylaod.lastName,
            email: paylaod.email,
            password: hashedPassword,
            cpf: paylaod.cpf,
            birthDate,
            phone: paylaod.phone,
            role: "USER",
        }
    });

    return newUser;
};

export const loginUser = async (data: AuthRequest) => {
    const user = await prisma.user.findUnique({
        where: { email: data.email },
    });

    if (!user) {
        throw new Error("Usuário não encontrado");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
        throw new Error("Senha inválida");
    }

    return user;
};