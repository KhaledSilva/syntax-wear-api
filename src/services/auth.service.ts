import { RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";

export const registerUser = async (paylaod: RegisterRequest) => {
    const birthDate = paylaod.birthDate ? new Date(paylaod.birthDate) : undefined;

    const existingUser = await prisma.user.findUnique({
        where: { email: paylaod.email },
    });

    if (existingUser) {
        throw new Error("Email já cadastrado");
    }

    const newUser = await prisma.user.create({
        data: {
            firstName: paylaod.firstName,
            lastName: paylaod.lastName,
            email: paylaod.email,
            password: paylaod.password,
            cpf: paylaod.cpf,
            birthDate,
            phone: paylaod.phone,
            role: "USER",
        }
    });

    return newUser;
};