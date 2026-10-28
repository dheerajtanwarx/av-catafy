"use client";

import type {
  AdminProductListQuery,
  CatalogueDetailDto,
  CatalogueDto,
  CatalogueInputParsed,
  CategoryDto,
  CategoryInput,
  Paginated,
  ProductDto,
  ProductInputParsed,
} from "@catafy/types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const queryKeys = {
  categories: ["admin", "categories"] as const,
  products: (q: AdminProductListQuery) => ["admin", "products", q] as const,
  productsAll: ["admin", "products"] as const,
  product: (id: string) => ["admin", "product", id] as const,
  catalogues: ["admin", "catalogues"] as const,
  catalogue: (id: string) => ["admin", "catalogue", id] as const,
};

// ---------- Categories ----------

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api<{ items: CategoryDto[] }>("/admin/categories").then((r) => r.items),
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      id
        ? api<CategoryDto>(`/admin/categories/${id}`, { method: "PUT", body: input })
        : api<CategoryDto>("/admin/categories", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

// ---------- Products ----------

export function useProducts(query: AdminProductListQuery) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: ({ signal }) => api<Paginated<ProductDto>>("/admin/products", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api<ProductDto>(`/admin/products/${id}`),
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInputParsed }) =>
      id
        ? api<ProductDto>(`/admin/products/${id}`, { method: "PUT", body: input })
        : api<ProductDto>("/admin/products", { method: "POST", body: input }),
    onSuccess: (product) => {
      qc.setQueryData(queryKeys.product(product.id), product);
      void qc.invalidateQueries({ queryKey: queryKeys.productsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.productsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

// ---------- Catalogues ----------

export function useCatalogues() {
  return useQuery({
    queryKey: queryKeys.catalogues,
    queryFn: () => api<{ items: CatalogueDto[] }>("/admin/catalogues").then((r) => r.items),
  });
}

export function useCatalogue(id: string) {
  return useQuery({
    queryKey: queryKeys.catalogue(id),
    queryFn: () => api<CatalogueDetailDto>(`/admin/catalogues/${id}`),
  });
}

export function useSaveCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CatalogueInputParsed }) =>
      id
        ? api<CatalogueDetailDto>(`/admin/catalogues/${id}`, { method: "PUT", body: input })
        : api<CatalogueDetailDto>("/admin/catalogues", { method: "POST", body: input }),
    onSuccess: (catalogue) => {
      qc.setQueryData(queryKeys.catalogue(catalogue.id), catalogue);
      void qc.invalidateQueries({ queryKey: queryKeys.catalogues });
    },
  });
}

export function useDeleteCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/catalogues/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalogues }),
  });
}
