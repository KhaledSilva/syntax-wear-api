import { prisma } from "../utils/prisma"
import { CreateProduct, ProductFilters } from "../types"

export const getProducts = async (filter: ProductFilters) => {
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
    })

    if (!product) {
        throw new Error("Produto não encontrado");
    }
    return product;
}

export const createProduct = async (data: CreateProduct) => {
    const existingProduct = await prisma.product.findUnique({
        where: { slug: data.slug },
    });

    if (existingProduct) {
        throw new Error("Slug já existe. Escolha outro nome para o produto");
    }
    const newProduct = await prisma.product.create({data});
    return newProduct;
}

export const updateProduct = async (id: number, data: Partial<CreateProduct>) => {
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

    const updatedProduct = await prisma.product.update({
        where: { id },
        data,
    });

    return updatedProduct;
}