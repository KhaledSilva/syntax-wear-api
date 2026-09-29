import { FastifyReply, FastifyRequest } from "fastify";
import { ProductFilters } from "../types";
import { getProducts } from "../services/products.service";

const parseNumber = (value?: string) => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const listProducts = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const sortBy = query.sortBy;
    const sortOrder = query.sortOrder;
    const active = query.active;
    const inStock = query.inStock;

    const filters: ProductFilters = {
        page: parseNumber(query.page),
        limit: parseNumber(query.limit),
        minPrice: parseNumber(query.minPrice),
        maxPrice: parseNumber(query.maxPrice),
        search: query.search,
        color: query.color,
        size: query.size,
        active: active === "true" ? true : active === "false" ? false : undefined,
        inStock: inStock === "true" ? true : inStock === "false" ? false : undefined,
        sortBy: sortBy === "price" || sortBy === "name" || sortBy === "createdAt" ? sortBy : undefined,
        sortOrder: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined,
    };

    const result = await getProducts(filters)
    reply.send(result)
}