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
