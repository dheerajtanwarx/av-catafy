import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="New product" />
      <ProductForm />
    </>
  );
}
