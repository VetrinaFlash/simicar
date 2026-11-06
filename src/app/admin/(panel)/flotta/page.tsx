import { and, asc, gt, inArray } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Plate } from "@/components/plate";
import { Badge, Empty, LinkButton, PageHeader, Panel, cx } from "@/components/ui";
import { VehicleArt } from "@/components/vehicle-art";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { FUEL_LABELS, STATUS_LABELS, expiringItems, mediaUrl, vehicleName } from "@/lib/vehicles";

export const metadata = { title: "Flotta" };

export default async function FleetPage() {
  await requireAdmin();
  const db = await getDb();
  const [vehicles, photos, upcoming] = await Promise.all([
    db.select().from(schema.vehicles).orderBy(asc(schema.vehicles.sortOrder), asc(schema.vehicles.brand)),
    db.select().from(schema.vehiclePhotos).orderBy(asc(schema.vehiclePhotos.sortOrder)),
    db
      .select({ vehicleId: schema.bookings.vehicleId, startAt: schema.bookings.startAt, endAt: schema.bookings.endAt })
      .from(schema.bookings)
      .where(and(inArray(schema.bookings.status, ["confirmed"]), gt(schema.bookings.endAt, Date.now())))
      .orderBy(asc(schema.bookings.startAt)),
  ]);
  const cover = new Map<string, string>();
  for (const p of photos) if (!cover.has(p.vehicleId)) cover.set(p.vehicleId, p.r2Key);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Flotta"
        sub={`${vehicles.filter((v) => v.status !== "inactive").length} mezzi attivi`}
        action={
          <LinkButton href="/admin/flotta/nuovo">
            <Plus className="size-4" /> Aggiungi veicolo
          </LinkButton>
        }
      />
      {vehicles.length === 0 ? (
        <Panel>
          <Empty
            title="Nessun veicolo in flotta"
            text="Aggiungi il primo mezzo: comparirà sul sito e nel calendario."
            action={<LinkButton href="/admin/flotta/nuovo">Aggiungi veicolo</LinkButton>}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const key = cover.get(v.id);
            const current = upcoming.find((b) => b.vehicleId === v.id && b.startAt <= now);
            const next = upcoming.find((b) => b.vehicleId === v.id && b.startAt > now);
            const alerts = expiringItems(v);
            return (
              <Link
                key={v.id}
                href={`/admin/flotta/${v.id}`}
                className={cx(
                  "group overflow-hidden rounded-2xl bg-paper ring-1 ring-line/70 transition-shadow hover:ring-ink-3",
                  v.status === "inactive" && "opacity-60",
                )}
              >
                <div className="relative aspect-[16/9] bg-concrete-2">
                  {key ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(key)} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <VehicleArt type={v.type} className="absolute inset-0 m-auto h-1/2 text-ink-3" />
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {current ? <Badge tone="warn">Fuori fino al {fmtDate(current.endAt)}</Badge> : null}
                    {v.status !== "available" && <Badge tone={v.status === "maintenance" ? "danger" : "neutral"}>{STATUS_LABELS[v.status]}</Badge>}
                    {!v.isPublic && v.status !== "inactive" && <Badge>Nascosto dal sito</Badge>}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-bold">{vehicleName(v)}</p>
                      <p className="mt-0.5 text-sm text-ink-3">
                        {v.type === "furgone" ? "Furgone" : "Auto"} · {FUEL_LABELS[v.fuel]} · {v.transmission === "automatico" ? "Automatico" : "Manuale"}
                      </p>
                    </div>
                    <Plate value={v.plate} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {next && <Badge>Prossimo: {fmtDate(next.startAt)}</Badge>}
                    {alerts.slice(0, 2).map((a) => (
                      <Badge key={a.label} tone={a.daysLeft < 0 ? "danger" : "warn"}>
                        {a.label} {a.daysLeft < 0 ? "scaduto" : `tra ${a.daysLeft} gg`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
