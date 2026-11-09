import { and, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { notifyAdmins } from "@/lib/notify";
import { getCronSecret } from "@/lib/secrets";
import { timingSafeEqual } from "@/lib/security/crypto";
import { addDays, romeToUtc, todayRome } from "@/lib/time";
import { expiringItems, vehicleName } from "@/lib/vehicles";

/** Lanciato dal cron del Worker ogni mattina. */
export async function POST(req: Request) {
  const env = await getEnv();
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !timingSafeEqual(secret, await getCronSecret())) return new Response("Forbidden", { status: 403 });

  const db = await getDb();
  const today = todayRome();
  const from = romeToUtc(today);
  const to = romeToUtc(addDays(today, 1));

  const [pickups, returns, vehicles, pending] = await Promise.all([
    db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.status, "confirmed"), eq(schema.bookings.kind, "rental"), gte(schema.bookings.startAt, from), lt(schema.bookings.startAt, to))),
    db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.status, "confirmed"), eq(schema.bookings.kind, "rental"), gte(schema.bookings.endAt, from), lt(schema.bookings.endAt, to))),
    db.select().from(schema.vehicles),
    db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(eq(schema.bookings.status, "pending"), lt(schema.bookings.createdAt, Date.now() - 12 * 3_600_000))),
  ]);

  const parts: string[] = [];
  if (pickups.length) parts.push(`${pickups.length} ${pickups.length === 1 ? "ritiro" : "ritiri"}`);
  if (returns.length) parts.push(`${returns.length} ${returns.length === 1 ? "riconsegna" : "riconsegne"}`);
  if (pending.length) parts.push(`${pending.length} richieste in attesa da più di 12 ore`);
  if (parts.length) await notifyAdmins({ type: "daily", title: "La giornata di oggi", body: parts.join(" · "), url: "/admin" });

  // Avvisi scadenze a 30, 7 e 0 giorni (non ogni giorno, per non disturbare)
  for (const v of vehicles) {
    if (v.status === "inactive") continue;
    for (const item of expiringItems(v, 30)) {
      if ([30, 7, 0].includes(item.daysLeft)) {
        await notifyAdmins({
          type: "expiry",
          title: `${item.label} in scadenza`,
          body: `${vehicleName(v)} (${v.plate}): ${item.daysLeft === 0 ? "scade oggi" : `scade tra ${item.daysLeft} giorni`}`,
          url: `/admin/flotta/${v.id}`,
        });
      }
    }
  }
  // Pulizia: limiti di frequenza vecchi
  await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(Date.now() - 2 * 86_400_000).run();
  return Response.json({ ok: true });
}
