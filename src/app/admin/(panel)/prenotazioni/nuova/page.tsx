import { and, asc, desc, ne } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { addDays, todayRome } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";
import { NewBookingForm } from "./new-booking-form";

export const metadata = { title: "Nuova prenotazione" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string; tipo?: string; c?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const [vehicles, customers] = await Promise.all([
    db.select().from(schema.vehicles).where(and(ne(schema.vehicles.status, "inactive"), ne(schema.vehicles.listing, "sale"))).orderBy(asc(schema.vehicles.sortOrder)),
    db
      .select({ id: schema.customers.id, firstName: schema.customers.firstName, lastName: schema.customers.lastName, phone: schema.customers.phone, email: schema.customers.email, blacklisted: schema.customers.blacklisted })
      .from(schema.customers)
      .orderBy(desc(schema.customers.updatedAt))
      .limit(1000),
  ]);
  const start = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayRome();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={sp.tipo === "blocco" ? "Blocca un mezzo" : "Nuova prenotazione"} sub="Le prenotazioni inserite qui sono già confermate." />
      <NewBookingForm
        vehicles={vehicles.map((v) => ({ id: v.id, name: vehicleName(v), plate: v.plate, deposit: v.depositEur }))}
        customers={customers}
        defaults={{
          kind: sp.tipo === "blocco" ? "block" : "rental",
          vehicleId: vehicles.some((v) => v.id === sp.v) ? sp.v! : (vehicles[0]?.id ?? ""),
          customerId: customers.some((c) => c.id === sp.c) ? sp.c! : "",
          startDate: start,
          endDate: addDays(start, 1),
        }}
      />
    </div>
  );
}
