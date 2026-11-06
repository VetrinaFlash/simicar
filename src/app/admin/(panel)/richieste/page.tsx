import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Plate } from "@/components/plate";
import { Badge, Empty, PageHeader, Panel } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { OCCUPYING } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { fmtDateTime, fmtDuration, relativeTime } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";
import { DecisionPanel } from "../prenotazioni/booking-actions";

export const metadata = { title: "Richieste" };

export default async function RequestsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(and(eq(schema.bookings.status, "pending"), eq(schema.bookings.kind, "rental")))
    .orderBy(asc(schema.bookings.startAt));

  // Conflitti: altre prenotazioni (attive o in attesa) sullo stesso mezzo e periodo
  const vehicleIds = [...new Set(rows.map((r) => r.b.vehicleId))];
  const others = vehicleIds.length
    ? await db
        .select({ id: schema.bookings.id, vehicleId: schema.bookings.vehicleId, startAt: schema.bookings.startAt, endAt: schema.bookings.endAt, status: schema.bookings.status })
        .from(schema.bookings)
        .where(and(inArray(schema.bookings.vehicleId, vehicleIds), inArray(schema.bookings.status, ["pending", ...OCCUPYING])))
    : [];
  const conflictsOf = (b: { id: string; vehicleId: string; startAt: number; endAt: number }) =>
    others.filter((o) => o.id !== b.id && o.vehicleId === b.vehicleId && o.startAt < b.endAt && o.endAt > b.startAt);

  return (
    <>
      <PageHeader title="Richieste" sub={rows.length ? `${rows.length} da gestire, in ordine di ritiro` : undefined} />
      {rows.length === 0 ? (
        <Panel>
          <Empty title="Nessuna richiesta in attesa" text="Le nuove richieste dal sito compaiono qui e ti arrivano anche come notifica." />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ b, v, c }) => {
            const conflicts = conflictsOf(b);
            const hardConflict = conflicts.some((x) => x.status !== "pending");
            return (
              <Panel key={b.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/prenotazioni/${b.id}`} className="min-w-0 hover:underline">
                    <p className="truncate text-[17px] font-bold">
                      {c?.firstName} {c?.lastName}
                    </p>
                    <p className="text-sm text-ink-3">Ricevuta {relativeTime(b.createdAt)}</p>
                  </Link>
                  <Plate value={v.plate} size="sm" />
                </div>
                <div className="my-4 rounded-xl bg-concrete p-3.5">
                  <p className="font-semibold">{vehicleName(v)}</p>
                  <p className="mt-1 text-sm text-ink-2 tabular">
                    {fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}
                  </p>
                  <p className="text-sm text-ink-3">{fmtDuration(b.startAt, b.endAt)}</p>
                </div>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {c?.blacklisted && <Badge tone="danger">Cliente in lista nera</Badge>}
                  {hardConflict && <Badge tone="danger">Mezzo già occupato</Badge>}
                  {!hardConflict && conflicts.length > 0 && <Badge tone="warn">{conflicts.length} altre richieste sulle stesse date</Badge>}
                  {b.customerNotes && <Badge>Ha lasciato un messaggio</Badge>}
                </div>
                <DecisionPanel bookingId={b.id} depositEur={b.depositEur} priceEur={b.priceEur} compact />
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
