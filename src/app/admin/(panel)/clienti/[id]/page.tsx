import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { anonymizeCustomerAction, updateCustomerAction } from "@/app/admin/actions/customers";
import { ConfirmButton } from "@/components/confirm-button";
import { LinkButton, PageHeader, Panel, PanelHeader, StatusBadge, eur } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();
  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, id) });
  if (!customer) notFound();
  const history = await db
    .select({ b: schema.bookings, v: schema.vehicles })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .where(eq(schema.bookings.customerId, id))
    .orderBy(desc(schema.bookings.startAt))
    .limit(50);
  const spent = history.filter((h) => h.b.status === "completed" || h.b.status === "confirmed").reduce((s, h) => s + (h.b.priceEur ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        sub={`${history.length} prenotazioni · ${eur(spent)} totali`}
        action={<LinkButton href={`/admin/prenotazioni/nuova?c=${id}`}><Plus className="size-4" /> Prenota per questo cliente</LinkButton>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <CustomerForm customer={customer} action={updateCustomerAction.bind(null, id)} submitLabel="Salva modifiche" />
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Storico" />
            <ul className="divide-y divide-line/60 px-5 pb-3">
              {history.length === 0 && <li className="py-4 text-sm text-ink-3">Nessuna prenotazione.</li>}
              {history.map(({ b, v }) => (
                <li key={b.id}>
                  <Link href={`/admin/prenotazioni/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{vehicleName(v)}</p>
                      <p className="text-xs text-ink-3">{fmtDate(b.startAt)} → {fmtDate(b.endAt)}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-5">
            <p className="text-sm font-bold">Cancella i dati personali</p>
            <p className="mt-1 text-sm text-ink-3">Per le richieste di cancellazione (GDPR). Lo storico dei noleggi resta, senza nome e contatti.</p>
            <ConfirmButton action={anonymizeCustomerAction.bind(null, id)} message="Cancellare definitivamente i dati personali di questo cliente?" variant="danger" className="mt-4">
              Anonimizza cliente
            </ConfirmButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
