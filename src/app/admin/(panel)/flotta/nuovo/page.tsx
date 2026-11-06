import { createVehicleAction } from "@/app/admin/actions/vehicles";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { VehicleForm } from "../vehicle-form";

export const metadata = { title: "Nuovo veicolo" };

export default async function NewVehiclePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Nuovo veicolo" sub="Dopo il salvataggio potrai aggiungere le foto." />
      <VehicleForm action={createVehicleAction} submitLabel="Salva e aggiungi foto" />
    </>
  );
}
