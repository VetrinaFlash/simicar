import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { Empty, LinkButton, PageHeader, Panel, StatusBadge, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";

export const metadata = { title: "Prenotazioni" };

const FILTERS = [
  { key: "attive", label: "Attive" },
  { key: "pending", label: "Da confermare" },
  { key: "completed", label: "Concluse" },
  { key: "chiuse", label: "Rifiutate e annullate" },
  { key: "tutte", label: "Tutte" },
] as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.f)?.key ?? "attive";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.min(500, Number(sp.p) || 1));
  const PER = 30;

  const where: SQL[] = [eq(schema.bookings.kind, "rental")];
  if (filter === "attive") where.push(sql`${schema.bookings.status} IN ('pending','confirmed') AND ${schema.bookings.endAt} > ${Date.now()}`);
  if (filter === "pending") where.push(eq(schema.bookings.status, "pending"));
  if (filter === "completed") where.push(eq(schema.bookings.status, "completed"));
  if (filter === "chiuse") where.push(sql`${schema.bookings.status} IN ('rejected','cancelled')`);
  if (q) {
    const term = `%${q.replace(/[%_]/g, "")}%`;
    where.push(
      or(
        like(schema.bookings.code, term),
        like(schema.customers.firstName, term),
        like(schema.customers.lastName, term),
        like(schema.customers.phone, term),
        like(schema.vehicles.plate, term),
        like(sql`${schema.customers.firstName} || ' ' || ${schema.customers.lastName}`, term),
      )!,
    );
  }

  const db = await getDb();
  const rows = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(and(...where))
    .orderBy(filter === "attive" ? schema.bookings.startAt : desc(schema.bookings.startAt))
    .limit(PER + 1)
    .offset((page - 1) * PER);
  const hasMore = rows.length > PER;
  const list = rows.slice(0, PER);
  const href = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { f: filter, q, ...o };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "p" && String(v) === "1")) p.set(k, String(v));
    return `/admin/prenotazioni?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Prenotazioni"
        action={
          <LinkButton href="/admin/prenotazioni/nuova">
            <Plus className="size-4" /> Nuova prenotazione
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ f: f.key, p: 1 })}
              className={cx(
                "h-9 shrink-0 rounded-full px-4 text-sm font-semibold leading-9 transition-colors",
                filter === f.key ? "bg-ink text-white" : "bg-paper text-ink-2 ring-1 ring-line hover:ring-ink-3",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="relative lg:w-80">
          <input type="hidden" name="f" value={filter} />
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome, telefono, targa o codice"
            className="h-11 w-full rounded-xl bg-paper pl-10 pr-3 text-[15px] ring-1 ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-eu"
          />
        </form>
      </div>

      <Panel className="overflow-hidden">
        {list.length === 0 ? (
          <Empty title={q ? "Nessun risultato" : "Nessuna prenotazione"} text={q ? `Nessuna prenotazione corrisponde a «${q}».` : undefined} />
        ) : (
          <ul className="divide-y divide-line/60">
            {list.map(({ b, v, c }) => (
              <li key={b.id}>
                <Link href={`/admin/prenotazioni/${b.id}`} className="grid gap-1 px-5 py-4 hover:bg-concrete/60 md:grid-cols-[1.2fr_1.3fr_1.5fr_auto] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c ? `${c.firstName} ${c.lastName}` : "—"}</p>
                    <p className="font-narrow text-xs font-bold tracking-wider text-ink-3">{b.code}</p>
                  </div>
                  <p className="truncate text-sm text-ink-2">{vehicleName(v)}</p>
                  <p className="text-sm text-ink-2 tabular">
                    {fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}
                  </p>
                  <div className="md:text-right">
                    <StatusBadge status={b.status} kind={b.kind} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {(page > 1 || hasMore) && (
        <div className="mt-4 flex justify-between">
          {page > 1 ? <LinkButton variant="secondary" href={href({ p: page - 1 })}>Precedenti</LinkButton> : <span />}
          {hasMore && <LinkButton variant="secondary" href={href({ p: page + 1 })}>Successive</LinkButton>}
        </div>
      )}
    </>
  );
}
