import type { Metadata } from "next";
import { CatalogueForm } from "@/components/admin/catalogue-form";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "New catalogue" };

export default function NewCataloguePage() {
  return (
    <>
      <PageHeader title="New catalogue" />
      <CatalogueForm />
    </>
  );
}
