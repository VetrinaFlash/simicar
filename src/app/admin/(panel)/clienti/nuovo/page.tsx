import { createCustomerAction } from "@/app/admin/actions/customers";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Nuovo cliente" };

export default async function NewCustomerPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuovo cliente" />
      <CustomerForm action={createCustomerAction} submitLabel="Salva cliente" />
    </div>
  );
}
