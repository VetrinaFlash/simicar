import "server-only";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv, runInBackground } from "@/lib/env";
import { bookingCode, newId } from "@/lib/security/crypto";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/send";
import {
  bookingCancelledMail,
  bookingConfirmedMail,
  bookingRejectedMail,
  bookingUpdatedMail,
  type BookingMailData,
} from "@/lib/email/templates";
import { vehicleName } from "@/lib/vehicles";

/** Stati che occupano il veicolo nel calendario. */
export const OCCUPYING = ["confirmed", "completed"] as const;

/**
 * Frammento SQL che verifica l'assenza di sovrapposizioni con prenotazioni
 * confermate o blocchi. Usato DENTRO l'istruzione di INSERT/UPDATE, così il
 * controllo e la scrittura sono un'unica operazione atomica: due conferme
 * simultanee non possono mai prenotare lo stesso mezzo.
 * Parametri: ?1 vehicle_id, ?2 start_at, ?3 end_at, ?4 id da escludere.
 */
const NO_OVERLAP = `NOT EXISTS (
  SELECT 1 FROM bookings o
  WHERE o.vehicle_id = ?1
    AND o.status IN ('confirmed','completed')
    AND o.start_at < ?3 AND o.end_at > ?2
    AND o.id <> ?4
)`;

export class BookingError extends Error {
  constructor(
    public code: "conflict" | "not_found" | "invalid_state" | "vehicle_unavailable",
    message: string,
  ) {
    super(message);
  }
}

type NewBooking = {
  vehicleId: string;
  customerId: string | null;
  kind: "rental" | "block";
  source: "web" | "admin";
  status: "pending" | "confirmed";
  startAt: number;
  endAt: number;
  customerNotes?: string | null;
  internalNotes?: string | null;
  priceEur?: number | null;
  depositEur?: number | null;
  decidedBy?: string | null;
};

/** Inserisce una prenotazione solo se il mezzo è libero (atomico). */
export async function insertBookingIfFree(b: NewBooking): Promise<{ id: string; code: string }> {
  const env = await getEnv();
  const id = newId();
  const now = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = bookingCode();
    try {
      const res = await env.DB.prepare(
        `INSERT INTO bookings (id, code, kind, vehicle_id, customer_id, source, status, start_at, end_at,
           customer_notes, internal_notes, price_eur, deposit_eur, decided_by, decided_at, created_at, updated_at)
         SELECT ?4, ?5, ?6, ?1, ?7, ?8, ?9, ?2, ?3, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16
         WHERE ${NO_OVERLAP}
           AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id = ?1 AND v.status <> 'inactive' AND (?6 = 'block' OR v.listing <> 'sale'))`,
      )
        .bind(
          b.vehicleId,
          b.startAt,
          b.endAt,
          id,
          code,
          b.kind,
          b.customerId,
          b.source,
          b.status,
          b.customerNotes ?? null,
          b.internalNotes ?? null,
          b.priceEur ?? null,
          b.depositEur ?? null,
          b.decidedBy ?? null,
          b.status === "confirmed" ? now : null,
          now,
        )
        .run();
      if (res.meta.changes !== 1) {
        throw new BookingError("conflict", "Il mezzo è già occupato in quelle date.");
      }
      return { id, code };
    } catch (err) {
      if (err instanceof BookingError) throw err;
      // Collisione (rarissima) sul codice univoco: riprova con un altro codice
      if (String(err).includes("UNIQUE") && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Impossibile generare il codice prenotazione");
}

async function changeStatus(
  id: string,
  from: string[],
  to: "confirmed" | "rejected" | "cancelled" | "completed",
  userId: string,
  extra: { rejectionReason?: string | null; kmIn?: number | null; fuelIn?: number | null } = {},
) {
  const env = await getEnv();
  const db = await getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!booking) throw new BookingError("not_found", "Prenotazione non trovata.");
  if (!from.includes(booking.status)) throw new BookingError("invalid_state", "La prenotazione è già stata gestita.");

  const placeholders = from.map((_, i) => `?${10 + i}`).join(",");
  const needsCheck = to === "confirmed";
  const res = await env.DB.prepare(
    `UPDATE bookings SET status = ?5, decided_by = ?6, decided_at = ?7, updated_at = ?7,
       rejection_reason = COALESCE(?8, rejection_reason),
       km_in = COALESCE(?9, km_in), fuel_in = COALESCE(?20, fuel_in)
     WHERE id = ?4 AND status IN (${placeholders}) ${needsCheck ? `AND ${NO_OVERLAP}` : "AND ?1 IS NOT NULL AND ?2 IS NOT NULL AND ?3 IS NOT NULL"}`,
  )
    .bind(
      booking.vehicleId,
      booking.startAt,
      booking.endAt,
      id,
      to,
      userId,
      Date.now(),
      extra.rejectionReason ?? null,
      extra.kmIn ?? null,
      ...from,
      ...Array(10 - from.length).fill(null),
      extra.fuelIn ?? null,
    )
    .run();

  if (res.meta.changes !== 1) {
    if (needsCheck) throw new BookingError("conflict", "Nel frattempo il mezzo è stato occupato da un'altra prenotazione.");
    throw new BookingError("invalid_state", "La prenotazione è stata modificata nel frattempo. Ricarica la pagina.");
  }
  if (to === "completed" && extra.kmIn != null) {
    await db
      .update(schema.vehicles)
      .set({ mileageKm: extra.kmIn, updatedAt: Date.now() })
      .where(eq(schema.vehicles.id, booking.vehicleId));
  }
  return booking;
}

export async function confirmBooking(id: string, userId: string, data: { priceEur?: number | null; depositEur?: number | null }) {
  const db = await getDb();
  if (data.priceEur !== undefined || data.depositEur !== undefined) {
    await db
      .update(schema.bookings)
      .set({ priceEur: data.priceEur ?? null, depositEur: data.depositEur ?? null })
      .where(and(eq(schema.bookings.id, id), eq(schema.bookings.status, "pending")));
  }
  await changeStatus(id, ["pending"], "confirmed", userId);
  await mailCustomer(id, "confirmed");
}

export async function rejectBooking(id: string, userId: string, reason: string | null) {
  await changeStatus(id, ["pending"], "rejected", userId, { rejectionReason: reason });
  await mailCustomer(id, "rejected");
}

export async function cancelBooking(id: string, userId: string, notify: boolean) {
  const b = await changeStatus(id, ["pending", "confirmed"], "cancelled", userId);
  if (notify && b.kind === "rental") await mailCustomer(id, "cancelled");
}

export async function completeBooking(id: string, userId: string, kmIn: number | null, fuelIn: number | null) {
  await changeStatus(id, ["confirmed"], "completed", userId, { kmIn, fuelIn });
}

/** Sposta una prenotazione (date e/o veicolo), con controllo atomico dei conflitti. */
export async function rescheduleBooking(
  id: string,
  next: { vehicleId: string; startAt: number; endAt: number },
  notify: boolean,
) {
  const env = await getEnv();
  const db = await getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, id) });
  if (!booking) throw new BookingError("not_found", "Prenotazione non trovata.");
  if (!["pending", "confirmed"].includes(booking.status))
    throw new BookingError("invalid_state", "Si possono spostare solo prenotazioni attive.");
  const checkOverlap = booking.status === "confirmed";
  const res = await env.DB.prepare(
    `UPDATE bookings SET vehicle_id = ?1, start_at = ?2, end_at = ?3, updated_at = ?5
     WHERE id = ?4 AND status = ?6 ${checkOverlap ? `AND ${NO_OVERLAP}` : ""}
       AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id = ?1 AND v.status <> 'inactive' AND (?7 = 'block' OR v.listing <> 'sale'))`,
  )
    .bind(next.vehicleId, next.startAt, next.endAt, id, Date.now(), booking.status, booking.kind)
    .run();
  if (res.meta.changes !== 1) throw new BookingError("conflict", "In quelle date il mezzo è già occupato.");
  const changed =
    booking.startAt !== next.startAt || booking.endAt !== next.endAt || booking.vehicleId !== next.vehicleId;
  if (notify && changed && booking.kind === "rental" && booking.status === "confirmed") await mailCustomer(id, "updated");
}

/** Intervalli occupati di un veicolo (per il calendario pubblico: nessun dato personale). */
export async function busyRanges(vehicleId: string, from: number, to: number) {
  const db = await getDb();
  return db
    .select({ startAt: schema.bookings.startAt, endAt: schema.bookings.endAt })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.vehicleId, vehicleId),
        inArray(schema.bookings.status, [...OCCUPYING]),
        lt(schema.bookings.startAt, to),
        gt(schema.bookings.endAt, from),
      ),
    )
    .orderBy(asc(schema.bookings.startAt));
}

/** Prenotazioni attive di un periodo per la timeline del pannello. */
export async function calendarBookings(from: number, to: number) {
  const db = await getDb();
  return db
    .select({
      id: schema.bookings.id,
      code: schema.bookings.code,
      kind: schema.bookings.kind,
      status: schema.bookings.status,
      source: schema.bookings.source,
      vehicleId: schema.bookings.vehicleId,
      startAt: schema.bookings.startAt,
      endAt: schema.bookings.endAt,
      internalNotes: schema.bookings.internalNotes,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
    })
    .from(schema.bookings)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(
      and(
        inArray(schema.bookings.status, ["pending", "confirmed", "completed"]),
        lt(schema.bookings.startAt, to),
        gt(schema.bookings.endAt, from),
      ),
    )
    .orderBy(asc(schema.bookings.startAt));
}

/** Richieste in attesa che si sovrappongono ad altre (da segnalare all'admin). */
export async function findConflicts(b: { id: string; vehicleId: string; startAt: number; endAt: number }) {
  const db = await getDb();
  return db
    .select({ id: schema.bookings.id, code: schema.bookings.code, status: schema.bookings.status })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.vehicleId, b.vehicleId),
        inArray(schema.bookings.status, ["pending", "confirmed", "completed"]),
        lt(schema.bookings.startAt, b.endAt),
        gt(schema.bookings.endAt, b.startAt),
      ),
    )
    .then((rows) => rows.filter((r) => r.id !== b.id));
}

export async function bookingMailData(id: string) {
  const db = await getDb();
  const row = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, id))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  const data: BookingMailData = {
    code: row.b.code,
    firstName: row.c?.firstName ?? "",
    vehicleName: vehicleName(row.v),
    plate: row.v.plate,
    startAt: row.b.startAt,
    endAt: row.b.endAt,
    priceEur: row.b.priceEur,
    depositEur: row.b.depositEur,
    reason: row.b.rejectionReason,
  };
  return { data, email: row.c?.email ?? null };
}

async function mailCustomer(id: string, kind: "confirmed" | "rejected" | "cancelled" | "updated") {
  const info = await bookingMailData(id);
  if (!info?.email) return;
  const s = await getSettings();
  const build = { confirmed: bookingConfirmedMail, rejected: bookingRejectedMail, cancelled: bookingCancelledMail, updated: bookingUpdatedMail }[kind];
  const mail = build(s, info.data);
  await runInBackground(
    sendEmail({
      to: info.email,
      ...mail,
      replyTo: s.email || undefined,
      idempotencyKey: kind === "updated" ? undefined : `${kind}-${id}`,
    }),
  );
}
