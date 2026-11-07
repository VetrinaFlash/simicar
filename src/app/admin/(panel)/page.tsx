import { and, asc, count, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { ArrowDownLeft, ArrowUpRight, Phone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PushToggle } from "@/components/push-toggle";
import { Badge, Empty, LinkButton, Panel, PanelHeader, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { addDays, fmtDate, fmtDateLong, fmtDateTime, romeToUtc, toRomeTime, todayRome } from "@/lib/time";
import { expiringItems, vehicleName } from "@/lib/vehicles";

export const metadata = { title: "Oggi" };

function greeting() {
  const h = Number(toRomeTime(Date.now()).slice(0, 2));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export default async function DashboardPage() {
  const me = await requireAdmin();
  const db = await getDb();
  const today = todayRome();
  const dayStart = romeToUtc(today);
  const dayEnd = romeToUtc(addDays(today, 1));
  const weekEnd = romeToUtc(addDays(today, 8));
  const now = Date.now();

  const joined = () =>
    db
      .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
      .from(schema.bookings)
      .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
      .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId));
  const rental = and(eq(schema.bookings.kind, "rental"), eq(schema.bookings.status, "confirmed"));

  // Mese corrente (ora italiana) per incasso e occupazione
  const monthStartIso = `${today.slice(0, 7)}-01`;
  const [yy, mm] = today.split("-").map(Number);
  const nextMonthIso = `${mm === 12 ? yy! + 1 : yy}-${String(mm === 12 ? 1 : mm! + 1).padStart(2, "0")}-01`;
  const mFrom = romeToUtc(monthStartIso);
  const mTo = romeToUtc(nextMonthIso);

  const [pickups, returns, pending, week, vehicles, [out], cargos, monthRows] = await Promise.all([
    joined().where(and(rental, gte(schema.bookings.startAt, dayStart), lt(schema.bookings.startAt, dayEnd))).orderBy(asc(schema.bookings.startAt)),
    joined().where(and(rental, gte(schema.bookings.endAt, dayStart), lt(schema.bookings.endAt, dayEnd))).orderBy(asc(schema.bookings.endAt)),
    joined().where(and(eq(schema.bookings.status, "pending"), eq(schema.bookings.kind, "rental"))).orderBy(asc(schema.bookings.createdAt)).limit(5),
    joined().where(and(rental, gte(schema.bookings.startAt, dayEnd), lt(schema.bookings.startAt, weekEnd))).orderBy(asc(schema.bookings.startAt)).limit(12),
    db.select().from(schema.vehicles).where(ne(schema.vehicles.status, "inactive")),
    db
      .select({ n: count() })
      .from(schema.bookings)
      .where(and(inArray(schema.bookings.status, ["confirmed"]), lt(schema.bookings.startAt, now), gte(schema.bookings.endAt, now))),
    // Noleggi confermati che partono entro 48 ore (o già partiti) senza comunicazione CaRGOS
    joined()
      .where(and(rental, isNull(schema.bookings.cargosSentAt), lt(schema.bookings.startAt, now + 48 * 3_600_000), gte(schema.bookings.endAt, now)))
      .orderBy(asc(schema.bookings.startAt))
      .limit(6),
    db
      .select({ startAt: schema.bookings.startAt, endAt: schema.bookings.endAt, priceEur: schema.bookings.priceEur })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.kind, "rental"),
          inArray(schema.bookings.status, ["confirmed", "completed"]),
          lt(schema.bookings.startAt, mTo),
          gte(schema.bookings.endAt, mFrom),
        ),
      ),
  ]);
  // Conteggi di noleggio solo sui mezzi a noleggio (i mezzi solo in vendita restano fuori)
  const rentalFleet = vehicles.filter((v) => v.listing !== "sale");
  const revenue = monthRows.filter((r) => r.startAt >= mFrom).reduce((sum, r) => sum + (r.priceEur ?? 0), 0);
  const busyMs = monthRows.reduce((sum, r) => sum + Math.max(0, Math.min(r.endAt, mTo) - Math.max(r.startAt, mFrom)), 0);
  const occupancy = rentalFleet.length ? Math.round((busyMs / ((mTo - mFrom) * rentalFleet.length)) * 100) : 0;
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(now);

  const maintenance = rentalFleet.filter((v) => v.status === "maintenance").length;
  const outNow = out?.n ?? 0;
  const free = Math.max(0, rentalFleet.length - outNow - maintenance);
  const expiring = vehicles.flatMap((v) => expiringItems(v).map((i) => ({ ...i, v }))).sort((a, b) => a.daysLeft - b.daysLeft);

  const Row = ({ r, at, icon }: { r: (typeof pickups)[number]; at: number; icon: "out" | "in" }) => (
    <li className="flex items-center gap-3 py-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${icon === "out" ? "bg-eu-soft text-eu" : "bg-go-soft text-go"}`}>
        {icon === "out" ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
      </span>
      <Link href={`/admin/prenotazioni/${r.b.id}`} className="min-w-0 flex-1 hover:underline">
        <p className="truncate font-semibold">
          <span className="tabular">{toRomeTime(at)}</span> · {r.c?.firstName} {r.c?.lastName}
        </p>
        <p className="truncate text-sm text-ink-3">
          {vehicleName(r.v)} · {r.v.plate}
        </p>
      </Link>
      {r.c?.phone && (
        <a href={`tel:${r.c.phone}`} className="grid size-10 shrink-0 place-items-center rounded-full bg-concrete hover:bg-concrete-2" aria-label={`Chiama ${r.c.firstName}`}>
          <Phone className="size-4" />
        </a>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px] capitalize text-ink-3">{fmtDateLong(now)}</p>
        <h1 className="font-narrow text-[34px] font-black uppercase leading-[0.95] text-eu-deep md:text-[44px]">
          {greeting()}, {me.name.split(" ")[0]}
        </h1>
      </div>

      <PushToggle variant="banner" />

      {/* Stato flotta adesso */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { n: String(free), label: "liberi adesso", tone: "text-go" },
          { n: String(outNow), label: maintenance ? `fuori a noleggio · ${maintenance} in officina` : "fuori a noleggio", tone: "text-eu" },
          { n: `€${Math.round(revenue).toLocaleString("it-IT")}`, label: `prenotato a ${monthName}`, tone: "text-eu-deep" },
          { n: `${occupancy}%`, label: `flotta occupata a ${monthName}`, tone: occupancy >= 60 ? "text-go" : "text-eu-deep" },
        ].map((k) => (
          <Panel key={k.label} className="px-4 py-4 md:px-5">
            <p className={`font-narrow text-[44px] font-black leading-none tabular md:text-[56px] ${k.tone}`}>{k.n}</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink-2 md:text-sm">{k.label}</p>
          </Panel>
        ))}
      </div>

      {pending.length > 0 && (
        <Panel className="ring-2 ring-signal">
          <PanelHeader
            title={`${pending.length === 5 ? "5+" : pending.length} ${pending.length === 1 ? "richiesta" : "richieste"} da confermare`}
            action={<LinkButton href="/admin/richieste" variant="secondary" className="h-9 px-3 text-sm">Gestisci</LinkButton>}
          />
          <ul className="divide-y divide-line/60 px-5 pb-2">
            {pending.map((r) => (
              <li key={r.b.id}>
                <Link href={`/admin/prenotazioni/${r.b.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.c?.firstName} {r.c?.lastName}</p>
                    <p className="truncate text-sm text-ink-3">{vehicleName(r.v)} · {fmtDateTime(r.b.startAt)}</p>
                  </div>
                  <StatusBadge status="pending" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {cargos.length > 0 && (
        <Panel className="ring-2 ring-red/50">
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-red" /> Da comunicare a CaRGOS
              </span>
            }
            sub="Noleggi in partenza entro 48 ore senza invio dei dati alla Polizia."
          />
          <ul className="divide-y divide-line/60 px-5 pb-2">
            {cargos.map((r) => (
              <li key={r.b.id}>
                <Link href={`/admin/prenotazioni/${r.b.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.c?.firstName} {r.c?.lastName}</p>
                    <p className="truncate text-sm text-ink-3">{vehicleName(r.v)} · ritiro {fmtDateTime(r.b.startAt)}</p>
                  </div>
                  <Badge tone="danger">Da inviare</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Ritiri di oggi" sub={pickups.length ? undefined : "Nessun ritiro previsto"} />
          {pickups.length > 0 && <ul className="divide-y divide-line/60 px-5 pb-2">{pickups.map((r) => <Row key={r.b.id} r={r} at={r.b.startAt} icon="out" />)}</ul>}
        </Panel>
        <Panel>
          <PanelHeader title="Riconsegne di oggi" sub={returns.length ? undefined : "Nessuna riconsegna prevista"} />
          {returns.length > 0 && <ul className="divide-y divide-line/60 px-5 pb-2">{returns.map((r) => <Row key={r.b.id} r={r} at={r.b.endAt} icon="in" />)}</ul>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Prossimi 7 giorni" action={<Link href="/admin/calendario" className="text-sm font-semibold text-eu hover:underline">Calendario</Link>} />
          {week.length === 0 ? (
            <Empty title="Settimana libera" text="Nessun ritiro confermato nei prossimi giorni." />
          ) : (
            <ul className="divide-y divide-line/60 px-5 pb-2">
              {week.map((r) => (
                <li key={r.b.id}>
                  <Link href={`/admin/prenotazioni/${r.b.id}`} className="grid grid-cols-[80px_1fr] items-center gap-3 py-3 hover:opacity-80">
                    <span className="text-sm font-bold capitalize text-ink-2">{fmtDate(r.b.startAt)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.c?.firstName} {r.c?.lastName}</span>
                      <span className="block truncate text-sm text-ink-3">{vehicleName(r.v)} · {toRomeTime(r.b.startAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Scadenze flotta" sub={expiring.length ? "Entro 30 giorni" : "Nessuna scadenza nei prossimi 30 giorni"} />
          {expiring.length > 0 && (
            <ul className="divide-y divide-line/60 px-5 pb-2">
              {expiring.slice(0, 8).map((e) => (
                <li key={`${e.v.id}-${e.label}`}>
                  <Link href={`/admin/flotta/${e.v.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{e.label} · {vehicleName(e.v)}</p>
                      <p className="text-xs text-ink-3">{e.v.plate}</p>
                    </div>
                    <Badge tone={e.daysLeft < 0 ? "danger" : "warn"}>{e.daysLeft < 0 ? "Scaduta" : e.daysLeft === 0 ? "Oggi" : `${e.daysLeft} gg`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
