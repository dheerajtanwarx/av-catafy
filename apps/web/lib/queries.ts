"use client";

import type {
  AdminCustomerDetail,
  AdminCustomerListQuery,
  AdminCustomerSummary,
  AdminOrderDetail,
  AdminOrderListQuery,
  AdminOrderSummary,
  AdminProductListQuery,
  CatalogueDetailDto,
  CatalogueDto,
  CatalogueInputParsed,
  CategoryDto,
  CategoryInput,
  CustomerUpdateInput,
  InvoiceStoreInfo,
  OrderStatus,
  OrderUpdateInput,
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
  ordersAll: ["admin", "orders"] as const,
  orders: (q: AdminOrderListQuery) => ["admin", "orders", q] as const,
  order: (id: string) => ["admin", "order", id] as const,
  orderPrint: (id: string) => ["admin", "order", id, "print"] as const,
  customersAll: ["admin", "customers"] as const,
  customers: (q: AdminCustomerListQuery) => ["admin", "customers", q] as const,
  customer: (id: string) => ["admin", "customer", id] as const,
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

// ---------- Orders ----------

export function useOrders(query: AdminOrderListQuery) {
  return useQuery({
    queryKey: queryKeys.orders(query),
    queryFn: ({ signal }) => api<Paginated<AdminOrderSummary>>("/admin/orders", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api<AdminOrderDetail>(`/admin/orders/${id}`),
  });
}

export function useOrderPrint(id: string) {
  return useQuery({
    queryKey: queryKeys.orderPrint(id),
    queryFn: () =>
      api<{ order: AdminOrderDetail; store: InvoiceStoreInfo }>(`/admin/orders/${id}/print`),
  });
}

/** Status changes and edits both return the full order; lists and customer totals go stale. */
function useOrderMutation<V>(mutationFn: (vars: V) => Promise<AdminOrderDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (order) => {
      qc.setQueryData(queryKeys.order(order.id), order);
      void qc.invalidateQueries({ queryKey: queryKeys.ordersAll });
      void qc.invalidateQueries({ queryKey: queryKeys.customersAll });
      void qc.invalidateQueries({ queryKey: queryKeys.customer(order.customerId) });
      // A cancellation returns stock.
      void qc.invalidateQueries({ queryKey: queryKeys.productsAll });
    },
  });
}

export function useChangeOrderStatus(id: string) {
  return useOrderMutation((status: OrderStatus) =>
    api<AdminOrderDetail>(`/admin/orders/${id}/status`, { method: "POST", body: { status } }),
  );
}

export function useUpdateOrder(id: string) {
  return useOrderMutation((input: OrderUpdateInput) =>
    api<AdminOrderDetail>(`/admin/orders/${id}`, { method: "PATCH", body: input }),
  );
}

// ---------- Customers ----------

export function useCustomers(query: AdminCustomerListQuery) {
  return useQuery({
    queryKey: queryKeys.customers(query),
    queryFn: ({ signal }) =>
      api<Paginated<AdminCustomerSummary>>("/admin/customers", { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => api<AdminCustomerDetail>(`/admin/customers/${id}`),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerUpdateInput) =>
      api<AdminCustomerDetail>(`/admin/customers/${id}`, { method: "PATCH", body: input }),
    onSuccess: (customer) => qc.setQueryData(queryKeys.customer(id), customer),
  });
}
