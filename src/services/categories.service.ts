import { prisma } from "../utils/prisma";
import { CreateCategory } from "../types";

type UpdateCategoryData = Partial<CreateCategory>;

export const getCategories = async () => {
    return prisma.category.findMany({
        orderBy: { name: "asc" },
    });
};

export const getCategoryById = async (id: number) => {
    const category = await prisma.category.findUnique({
        where: { id },
    });

    if (!category) {
        throw new Error("Categoria não encontrada");
    }

    return category;
};

export const createCategory = async (data: CreateCategory) => {
    const existingCategory = await prisma.category.findUnique({
        where: { slug: data.slug },
    });

    if (existingCategory) {
        throw new Error("Slug já existe. Escolha outro nome para a categoria");
    }

    return prisma.category.create({ data });
};

export const updateCategory = async (id: number, data: UpdateCategoryData) => {
    const existingCategory = await prisma.category.findUnique({
        where: { id },
    });

    if (!existingCategory) {
        throw new Error("Categoria não encontrada");
    }

    if (data.slug) {
        const slugExists = await prisma.category.findUnique({
            where: { slug: data.slug },
        });

        if (slugExists && slugExists.id !== id) {
            throw new Error("Slug já existe. Escolha outro nome para a categoria");
        }
    }

    return prisma.category.update({
        where: { id },
        data,
    });
};

export const deleteCategory = async (id: number) => {
    const existingCategory = await prisma.category.findUnique({
        where: { id },
        select: { id: true },
    });

    if (!existingCategory) {
        throw new Error("Categoria não encontrada");
    }

    const result = await prisma.category.deleteMany({
        where: {
            id,
            products: { none: {} },
        },
    });

    if (result.count === 0) {
        const categoryStillExists = await prisma.category.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!categoryStillExists) {
            throw new Error("Categoria não encontrada");
        }

        throw new Error("Não é possível excluir uma categoria com produtos vinculados");
    }
};
