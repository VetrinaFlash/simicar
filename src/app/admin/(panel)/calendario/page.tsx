import { asc, ne } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { calendarBookings } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { addDays, diffDays, romeToUtc, todayRome } from "@/lib/time";
import { vehicleName } from "@/lib/vehicles";
import { Timeline } from "./timeline";

export const metadata = { title: "Calendario" };

const DAYS = 35;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ da?: string; giorno?: string }> }) {
  await requireAdmin();
  const { da, giorno } = await searchParams;
  const today = todayRome();
  const start = da && /^\d{4}-\d{2}-\d{2}$/.test(da) ? da : addDays(today, -3);
  const selectedDay = giorno && /^\\d{4}-\\d{2}-\\d{2}$/.test(giorno) && diffDays(start, giorno) >= 0 && diffDays(start, giorno) < DAYS
    ? giorno
    : today && diffDays(start, today) >= 0 && diffDays(start, today) < DAYS ? today : start;
  const from = romeToUtc(start);
  const to = romeToUtc(addDays(start, DAYS));
  const db = await getDb();
  const [vehicles, bookings] = await Promise.all([
    db.select().from(schema.vehicles).where(ne(schema.vehicles.status, "inactive")).orderBy(asc(schema.vehicles.sortOrder), asc(schema.vehicles.brand)),
    calendarBookings(from, to),
  ]);
  return (
    <Timeline
      key={start}
      start={start}
      days={DAYS}
      today={today}
      selectedDay={selectedDay}
      vehicles={vehicles.map((v) => ({ id: v.id, name: vehicleName(v), plate: v.plate, type: v.type, status: v.status }))}
      bookings={bookings.map((b) => ({
        id: b.id,
        code: b.code,
        kind: b.kind,
        status: b.status,
        vehicleId: b.vehicleId,
        startAt: b.startAt,
        endAt: b.endAt,
        label: b.kind === "block" ? b.internalNotes || "Blocco" : `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim(),
      }))}
    />
  );
}
