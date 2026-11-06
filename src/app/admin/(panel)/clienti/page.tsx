import { desc, like, or, sql } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { Badge, Empty, LinkButton, PageHeader, Panel } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { relativeTime } from "@/lib/time";

export const metadata = { title: "Clienti" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const db = await getDb();
  const term = `%${q.replace(/[%_]/g, "")}%`;
  const rows = await db
    .select({
      c: schema.customers,
      rentals: sql<number>`(SELECT count(*) FROM bookings b WHERE b.customer_id = ${schema.customers.id} AND b.status IN ('confirmed','completed'))`,
    })
    .from(schema.customers)
    .where(
      q
        ? or(
            like(sql`${schema.customers.firstName} || ' ' || ${schema.customers.lastName}`, term),
            like(schema.customers.phone, term),
            like(schema.customers.email, term),
            like(schema.customers.taxCode, term),
          )
        : undefined,
    )
    .orderBy(desc(schema.customers.updatedAt))
    .limit(100);

  return (
    <>
      <PageHeader title="Clienti" action={<LinkButton href="/admin/clienti/nuovo"><Plus className="size-4" /> Nuovo cliente</LinkButton>} />
      <form className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input name="q" defaultValue={q} placeholder="Nome, telefono, email o codice fiscale" className="h-11 w-full rounded-xl bg-paper pl-10 pr-3 text-[15px] ring-1 ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-eu" />
      </form>
      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty title={q ? "Nessun cliente trovato" : "Ancora nessun cliente"} text={q ? undefined : "I clienti si creano da soli con le richieste dal sito, oppure puoi aggiungerli tu."} />
        ) : (
          <ul className="divide-y divide-line/60">
            {rows.map(({ c, rentals }) => (
              <li key={c.id}>
                <Link href={`/admin/clienti/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-concrete/60">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.firstName} {c.lastName}</p>
                    <p className="truncate text-sm text-ink-3">{[c.phone, c.email].filter(Boolean).join(" · ") || "Nessun contatto"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.blacklisted && <Badge tone="danger">Lista nera</Badge>}
                    <span className="hidden text-sm text-ink-3 sm:inline">{rentals} noleggi · {relativeTime(c.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
