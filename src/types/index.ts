export interface ProductFilters {
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  color?: string;
  size?: string;
  active?: boolean;
  inStock?: boolean;
  sortBy?: "price" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface AuthRequest {
    email: string;
    password: string;
}

export interface RegisterRequest extends AuthRequest {
    firstName: string;
    lastName: string;
    cpf?: string;
    birthDate?: string;
    phone?: string;
    role?: "USER" | "ADMIN";
}

export interface CreateProduct {
    name: string;
    description: string;
    price: number;
    categoryId: number;
    colors?: string[];
    sizes?: string[];
    slug: string;
    stock: number;
    active: boolean;
    images?: string[];
}

export interface CreateCategory {
    name: string;
    slug: string;
    description?: string | null;
}

export interface UpdateCategory extends Partial<CreateCategory> {
    active?: boolean;
}

export interface UpdateProduct extends Partial<CreateProduct> {
    name?: string;
    description?: string;
    price?: number;
    slug?: string;
    stock?: number;
    active?: boolean;
}

export interface OrderFilters {
    page?: number;
    limit?: number;
    status?: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
    userId?: number;
    startDate?: string;
    endDate?: string;
    sortBy?: "createdAt" | "totalPrice";
    sortOrder?: "asc" | "desc";
}