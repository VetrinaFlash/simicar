import { desc, isNull } from "drizzle-orm";
import { adminOrNull } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

/** Chiamata dal service worker alla ricezione di una push. */
export async function GET() {
  const user = await adminOrNull();
  if (!user) return Response.json({ items: [] }, { status: 401, headers: { "cache-control": "no-store" } });
  const db = await getDb();
  const items = await db
    .select({ id: schema.notifications.id, title: schema.notifications.title, body: schema.notifications.body, url: schema.notifications.url })
    .from(schema.notifications)
    .where(isNull(schema.notifications.readAt))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(3);
  return Response.json({ items }, { headers: { "cache-control": "no-store" } });
}
