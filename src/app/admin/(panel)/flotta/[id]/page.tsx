import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteVehicleAction, updateVehicleAction } from "@/app/admin/actions/vehicles";
import { Plate } from "@/components/plate";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, PageHeader, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { expiringItems, vehicleName } from "@/lib/vehicles";
import { PhotoManager } from "../photo-manager";
import { VehicleForm } from "../vehicle-form";

export const metadata = { title: "Veicolo" };

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuovo?: string }> }) {
  await requireAdmin();
  const [{ id }, { nuovo }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const vehicle = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id) });
  if (!vehicle) notFound();
  const [photos, upcoming] = await Promise.all([
    db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, id)).orderBy(asc(schema.vehiclePhotos.sortOrder), asc(schema.vehiclePhotos.createdAt)),
    db
      .select({ b: schema.bookings, c: schema.customers })
      .from(schema.bookings)
      .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
      .where(and(eq(schema.bookings.vehicleId, id), inArray(schema.bookings.status, ["pending", "confirmed"]), gt(schema.bookings.endAt, Date.now())))
      .orderBy(asc(schema.bookings.startAt))
      .limit(8),
  ]);
  const alerts = expiringItems(vehicle);
  const update = updateVehicleAction.bind(null, id);
  const remove = deleteVehicleAction.bind(null, id);

  return (
    <>
      <PageHeader
        title={vehicleName(vehicle)}
        sub={<Plate value={vehicle.plate} size="sm" />}
        action={
          vehicle.isPublic && vehicle.status !== "inactive" ? (
            <Link href={`/flotta/${vehicle.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold text-eu hover:underline">
              Vedi sul sito <ExternalLink className="size-4" />
            </Link>
          ) : null
        }
      />
      {nuovo && photos.length === 0 && (
        <p className="mb-5 rounded-xl bg-go-soft px-4 py-3 text-sm font-semibold text-go">Veicolo salvato. Ora aggiungi qualche foto.</p>
      )}
      {alerts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <Badge key={a.label} tone={a.daysLeft < 0 ? "danger" : "warn"}>
              {a.label}: {a.daysLeft < 0 ? `scaduto da ${-a.daysLeft} gg` : `scade tra ${a.daysLeft} gg`}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <PhotoManager vehicleId={id} photos={photos.map((p) => ({ id: p.id, r2Key: p.r2Key }))} />
          <VehicleForm vehicle={vehicle} action={update} submitLabel="Salva modifiche" />
        </div>
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Prossime prenotazioni" />
            <ul className="divide-y divide-line/60 px-5 pb-3">
              {upcoming.length === 0 && <li className="py-4 text-sm text-ink-3">Nessuna prenotazione in programma.</li>}
              {upcoming.map(({ b, c }) => (
                <li key={b.id}>
                  <Link href={`/admin/prenotazioni/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.kind === "block" ? b.internalNotes || "Blocco" : `${c?.firstName ?? ""} ${c?.lastName ?? ""}`}</p>
                      <p className="text-xs text-ink-3">{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</p>
                    </div>
                    <StatusBadge status={b.status} kind={b.kind} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-5">
            <p className="text-sm font-bold">Rimuovi dalla flotta</p>
            <p className="mt-1 text-sm text-ink-3">Se il veicolo ha uno storico di noleggi viene solo disattivato, così lo storico resta completo.</p>
            <ConfirmButton action={remove} message="Rimuovere questo veicolo dalla flotta?" className="mt-4" variant="danger">
              Rimuovi veicolo
            </ConfirmButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
