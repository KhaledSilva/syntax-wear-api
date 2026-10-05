import { prisma } from "../utils/prisma"
import { CreateProduct, ProductFilters } from "../types"

type ProductCategoryInput = {
    categoryId?: number;
};

type ProductFiltersWithCategory = ProductFilters & {
    categoryId?: number;
};

const ensureCategoryExists = async (categoryId: number | undefined) => {
    if (categoryId === undefined) {
        return;
    }

    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true },
    });

    if (!category) {
        throw new Error("Categoria não encontrada");
    }
};

export const getProducts = async (filter: ProductFiltersWithCategory) => {
    const {
        page: requestedPage = 1,
        limit: requestedLimit = 20,
        minPrice,
        maxPrice,
        search,
        color,
        size,
        active,
        inStock,
        categoryId,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = filter;
    const page = Math.max(1, Math.floor(requestedPage));
    const limit = Math.min(100, Math.max(1, Math.floor(requestedLimit)));

    const where: Record<string, any> = {};

    if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
        };
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
        ];
    }

    if (color) where.colors = { has: color };
    if (size) where.sizes = { array_contains: [size] };
    if (active !== undefined) where.active = active;
    if (categoryId !== undefined) where.categoryId = categoryId;
    if (inStock !== undefined) {
        where.stock = inStock ? { gt: 0 } : { lte: 0 };
    }

    return prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
    });
}

export const getProductById = async (id: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: { 
            category: true 
        },
    })

    if (!product) {
        throw new Error("Produto não encontrado");
    }
    return product;
}

export const createProduct = async (data: CreateProduct & ProductCategoryInput) => {
    const existingProduct = await prisma.product.findUnique({
        where: { slug: data.slug },
    });

    if (existingProduct) {
        throw new Error("Slug já existe. Escolha outro nome para o produto");
    }

    if (data.categoryId === undefined) {
        throw new Error("Categoria é obrigatória para criar um produto");
    }

    await ensureCategoryExists(data.categoryId);

    const { categoryId, ...productData } = data;
    const newProduct = await prisma.product.create({
        data: {
            ...productData,
            category: { connect: { id: categoryId } },
        },
    });
    return newProduct;
}

export const updateProduct = async (id: number, data: Partial<CreateProduct> & ProductCategoryInput) => {
    const existingProduct = await prisma.product.findUnique({
        where: { id },
    });

    if (!existingProduct) {
        throw new Error("Produto não encontrado");
    }

    if (data.slug) {
        const slugExists = await prisma.product.findUnique({
            where: { slug: data.slug },
        });

        if (slugExists && slugExists.id !== id) {
            throw new Error("Slug já existe. Escolha outro nome para o produto");
        }
    }

    await ensureCategoryExists(data.categoryId);

    const { categoryId, ...productData } = data;

    const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
            ...productData,
            ...(categoryId !== undefined && {
                category: { connect: { id: categoryId } },
            }),
        },
    });

    return updatedProduct;
};

export const deleteProduct = async (id: number) => {
    const existingProduct = await prisma.product.findUnique({
        where: { id },
    })

    if (!existingProduct) {
        throw new Error("Produto não encontrado");
    }

    await prisma.product.update({
        where: { id },
        data: { active: false}
    });
};