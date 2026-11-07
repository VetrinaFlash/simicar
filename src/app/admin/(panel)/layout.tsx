import type { Metadata } from "next";
import { and, count, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AdminShell } from "./shell";

export const metadata: Metadata = {
  title: { default: "Gestione", template: "%s · Gestione" },
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Gestione", statusBarStyle: "default" },
};

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const db = await getDb();
  const [s, [pending], [unread], [inquiries]] = await Promise.all([
    getSettings(),
    db
      .select({ n: count() })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.status, "pending"), eq(schema.bookings.kind, "rental"))),
    db.select({ n: count() }).from(schema.notifications).where(isNull(schema.notifications.readAt)),
    db.select({ n: count() }).from(schema.saleInquiries).where(eq(schema.saleInquiries.status, "new")),
  ]);
  return (
    <AdminShell user={user} businessName={s.businessName} pending={pending?.n ?? 0} unread={unread?.n ?? 0} inquiries={inquiries?.n ?? 0}>
      {children}
    </AdminShell>
  );
}
