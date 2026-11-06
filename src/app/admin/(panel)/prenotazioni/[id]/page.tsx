import { asc, eq, ne } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/plate";
import { Badge, Panel, PanelHeader, StatusBadge, eur } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { findConflicts } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { fmtDateLong, fmtDateTime, fmtDuration, relativeTime, toRomeDate, toRomeTime } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";
import { CancelBooking, DecisionPanel, DetailsForm, HandoverForms, MoveForm } from "../booking-actions";

export const metadata = { title: "Prenotazione" };

function waLink(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${digits.startsWith("39") || digits.length > 10 ? digits : `39${digits}`}`;
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();
  const row = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, id))
    .limit(1)
    .then((r) => r[0]);
  if (!row) notFound();
  const { b, v, c } = row;
  const isBlock = b.kind === "block";
  const active = b.status === "pending" || b.status === "confirmed";
  const [conflicts, vehicles] = await Promise.all([
    active ? findConflicts(b) : Promise.resolve([]),
    db.select({ id: schema.vehicles.id, brand: schema.vehicles.brand, model: schema.vehicles.model, version: schema.vehicles.version, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(ne(schema.vehicles.status, "inactive"))
      .orderBy(asc(schema.vehicles.sortOrder)),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={b.status === "pending" ? "/admin/richieste" : "/admin/prenotazioni"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> {b.status === "pending" ? "Richieste" : "Prenotazioni"}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-wide text-[26px] font-extrabold tracking-tight md:text-[32px]">
          {isBlock ? "Blocco" : `${c?.firstName ?? ""} ${c?.lastName ?? ""}`}
        </h1>
        <StatusBadge status={b.status} kind={b.kind} />
        <span className="rounded-md bg-signal px-2 py-0.5 font-narrow text-sm font-bold tracking-wider">{b.code}</span>
        <span className="text-sm text-ink-3">
          {b.source === "web" ? "Dal sito" : "Inserita da te"} · {relativeTime(b.createdAt)}
        </span>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-5 flex gap-3 rounded-2xl bg-signal-soft p-4 text-sm text-[#5f4600] ring-1 ring-signal/60">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="font-bold">Si sovrappone ad altre prenotazioni sullo stesso mezzo</p>
            <p className="mt-1">
              {conflicts.map((x, i) => (
                <span key={x.id}>
                  {i > 0 && ", "}
                  <Link className="font-semibold underline" href={`/admin/prenotazioni/${x.id}`}>
                    {x.code}
                  </Link>{" "}
                  ({x.status === "pending" ? "da confermare" : "confermata"})
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Panel>
            <div className="grid gap-px overflow-hidden rounded-2xl bg-line/60 sm:grid-cols-2">
              <div className="bg-paper p-5">
                <p className="text-sm text-ink-3">Ritiro</p>
                <p className="mt-1 text-[19px] font-bold capitalize">{fmtDateLong(b.startAt)}</p>
                <p className="font-wide text-3xl font-extrabold tabular">{toRomeTime(b.startAt)}</p>
              </div>
              <div className="bg-paper p-5">
                <p className="text-sm text-ink-3">Riconsegna</p>
                <p className="mt-1 text-[19px] font-bold capitalize">{fmtDateLong(b.endAt)}</p>
                <p className="font-wide text-3xl font-extrabold tabular">{toRomeTime(b.endAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <Link href={`/admin/flotta/${v.id}`} className="min-w-0 hover:underline">
                <p className="truncate font-bold">{vehicleName(v)}</p>
                <p className="text-sm text-ink-3">{fmtDuration(b.startAt, b.endAt)}</p>
              </Link>
              <Plate value={v.plate} size="sm" />
            </div>
          </Panel>

          {b.status === "pending" && (
            <Panel className="p-5">
              <p className="mb-4 text-[17px] font-bold">Rispondi alla richiesta</p>
              <DecisionPanel bookingId={b.id} depositEur={b.depositEur} priceEur={b.priceEur} />
            </Panel>
          )}

          {b.status === "confirmed" && !isBlock && (
            <Panel className="p-5">
              <HandoverForms bookingId={b.id} kmOut={b.kmOut} fuelOut={b.fuelOut} mileage={v.mileageKm} />
            </Panel>
          )}

          {b.customerNotes && (
            <Panel className="p-5">
              <p className="text-sm font-bold text-ink-2">Messaggio del cliente</p>
              <p className="mt-2 whitespace-pre-line text-[15px]">{b.customerNotes}</p>
            </Panel>
          )}

          {b.status === "rejected" && b.rejectionReason && (
            <Panel className="p-5">
              <p className="text-sm font-bold text-ink-2">Motivo del rifiuto</p>
              <p className="mt-2 text-[15px]">{b.rejectionReason}</p>
            </Panel>
          )}

          {b.status === "completed" && (
            <Panel className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
              <div><p className="text-ink-3">Km consegna</p><p className="font-bold tabular">{b.kmOut?.toLocaleString("it-IT") ?? "—"}</p></div>
              <div><p className="text-ink-3">Km rientro</p><p className="font-bold tabular">{b.kmIn?.toLocaleString("it-IT") ?? "—"}</p></div>
              <div><p className="text-ink-3">Km percorsi</p><p className="font-bold tabular">{b.kmIn != null && b.kmOut != null ? (b.kmIn - b.kmOut).toLocaleString("it-IT") : "—"}</p></div>
              <div><p className="text-ink-3">Carburante</p><p className="font-bold">{b.fuelOut ?? "—"}/8 → {b.fuelIn ?? "—"}/8</p></div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {c && (
            <Panel>
              <PanelHeader
                title="Cliente"
                action={
                  <Link href={`/admin/clienti/${c.id}`} className="text-sm font-semibold text-eu hover:underline">
                    Scheda
                  </Link>
                }
              />
              <div className="space-y-1 px-5 pb-5">
                {c.blacklisted && <Badge tone="danger">In lista nera{c.blacklistReason ? `: ${c.blacklistReason}` : ""}</Badge>}
                {c.phone && (
                  <div className="flex gap-2 pt-1">
                    <a href={`tel:${c.phone}`} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-concrete font-semibold hover:bg-concrete-2">
                      <Phone className="size-4" /> Chiama
                    </a>
                    <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-concrete font-semibold hover:bg-concrete-2">
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  </div>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 pt-2 text-sm text-ink-2 hover:text-eu">
                    <Mail className="size-4" /> {c.email}
                  </a>
                )}
                {c.phone && <p className="flex items-center gap-2 text-sm text-ink-2"><Phone className="size-4" /> {c.phone}</p>}
                {!c.licenseNumber && b.status !== "rejected" && b.status !== "cancelled" && (
                  <p className="pt-2 text-xs text-ink-3">Mancano i dati di patente e documento: completali al ritiro dalla scheda cliente.</p>
                )}
              </div>
            </Panel>
          )}

          <Panel className="p-5">
            {!isBlock && (
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-ink-3">Prezzo</p><p className="text-[17px] font-bold">{eur(b.priceEur)}</p></div>
                <div><p className="text-ink-3">Cauzione</p><p className="text-[17px] font-bold">{eur(b.depositEur)}</p></div>
              </div>
            )}
            <DetailsForm bookingId={b.id} priceEur={b.priceEur} depositEur={b.depositEur} internalNotes={b.internalNotes} isBlock={isBlock} />
          </Panel>

          {active && (
            <Panel className="p-5">
              <p className="mb-3 text-[15px] font-bold">Cambia date o veicolo</p>
              <MoveForm
                bookingId={b.id}
                vehicles={vehicles.map((x) => ({ id: x.id, name: `${vehicleName(x)} · ${x.plate}` }))}
                value={{ vehicleId: b.vehicleId, startDate: toRomeDate(b.startAt), startTime: toRomeTime(b.startAt), endDate: toRomeDate(b.endAt), endTime: toRomeTime(b.endAt) }}
                canNotify={!isBlock && b.status === "confirmed" && !!c?.email}
              />
            </Panel>
          )}

          {active && (
            <Panel className="p-5">
              <CancelBooking bookingId={b.id} canNotify={!isBlock && !!c?.email} />
            </Panel>
          )}
          <p className="px-1 text-xs text-ink-3">Ultima modifica: {fmtDateTime(b.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
