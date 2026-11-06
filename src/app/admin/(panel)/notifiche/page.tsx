import { desc, isNull } from "drizzle-orm";
import Link from "next/link";
import { Empty, PageHeader, Panel, cx } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { relativeTime } from "@/lib/time";

export const metadata = { title: "Notifiche" };

export default async function NotificationsPage() {
  await requireAdmin();
  const db = await getDb();
  const items = await db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt)).limit(60);
  // Aprire la pagina le segna come lette (l'evidenziazione resta per questa visita)
  if (items.some((n) => !n.readAt)) await db.update(schema.notifications).set({ readAt: Date.now() }).where(isNull(schema.notifications.readAt));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifiche" />
      <Panel className="overflow-hidden">
        {items.length === 0 ? (
          <Empty title="Nessuna notifica" text="Qui trovi le nuove richieste, i promemoria del giorno e le scadenze della flotta." />
        ) : (
          <ul className="divide-y divide-line/60">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.url ?? "/admin"} className={cx("flex gap-3 px-5 py-4 hover:bg-concrete/60", !n.readAt && "bg-eu-soft/50")}>
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-eu")} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm text-ink-2">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-3">{relativeTime(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
