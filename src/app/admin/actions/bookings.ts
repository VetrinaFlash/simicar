"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import {
  BookingError,
  cancelBooking,
  completeBooking,
  confirmBooking,
  insertBookingIfFree,
  rejectBooking,
  rescheduleBooking,
  bookingMailData,
} from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { runInBackground } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { bookingConfirmedMail } from "@/lib/email/templates";
import { newId } from "@/lib/security/crypto";
import { getSettings } from "@/lib/settings";
import { romeToUtc } from "@/lib/time";
import { MAX_RENTAL_MS, adminBookingSchema, firstError, hhmm, isoDate } from "@/lib/validation";

export type ActionResult = { ok?: boolean; error?: string };

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error(err);
    return { error: "Operazione non riuscita. Riprova." };
  }
}

const id = z.string().uuid();
const money = z
  .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export async function confirmBookingAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = z.object({ priceEur: money, depositEur: money }).safeParse(Object.fromEntries(form));
  if (!id.safeParse(bookingId).success || !parsed.success) return { error: "Dati non validi." };
  return guard(async () => {
    await confirmBooking(bookingId, me.id, parsed.data);
    await audit("booking.confirmed", { userId: me.id, entity: "booking", entityId: bookingId });
  });
}

export async function rejectBookingAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const reason = z.string().trim().max(500).safeParse(form.get("reason") ?? "");
  if (!id.safeParse(bookingId).success || !reason.success) return { error: "Dati non validi." };
  return guard(async () => {
    await rejectBooking(bookingId, me.id, reason.data || null);
    await audit("booking.rejected", { userId: me.id, entity: "booking", entityId: bookingId });
  });
}

export async function cancelBookingAction(bookingId: string, notify: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!id.safeParse(bookingId).success) return { error: "Dati non validi." };
  return guard(async () => {
    await cancelBooking(bookingId, me.id, notify);
    await audit("booking.cancelled", { userId: me.id, entity: "booking", entityId: bookingId });
  });
}

export async function checkoutAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      kmOut: z.union([z.literal(""), z.coerce.number().int().min(0).max(5_000_000)]),
      fuelOut: z.union([z.literal(""), z.coerce.number().int().min(0).max(8)]),
    })
    .safeParse(Object.fromEntries(form));
  if (!id.safeParse(bookingId).success || !parsed.success) return { error: "Dati non validi." };
  return guard(async () => {
    const db = await getDb();
    await db
      .update(schema.bookings)
      .set({
        kmOut: parsed.data.kmOut === "" ? null : parsed.data.kmOut,
        fuelOut: parsed.data.fuelOut === "" ? null : parsed.data.fuelOut,
        updatedAt: Date.now(),
      })
      .where(eq(schema.bookings.id, bookingId));
  });
}

export async function returnAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = z
    .object({
      kmIn: z.union([z.literal(""), z.coerce.number().int().min(0).max(5_000_000)]),
      fuelIn: z.union([z.literal(""), z.coerce.number().int().min(0).max(8)]),
    })
    .safeParse(Object.fromEntries(form));
  if (!id.safeParse(bookingId).success || !parsed.success) return { error: "Dati non validi." };
  return guard(async () => {
    await completeBooking(
      bookingId,
      me.id,
      parsed.data.kmIn === "" ? null : parsed.data.kmIn,
      parsed.data.fuelIn === "" ? null : parsed.data.fuelIn,
    );
    await audit("booking.completed", { userId: me.id, entity: "booking", entityId: bookingId });
  });
}

export async function updateBookingDetailsAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      priceEur: money,
      depositEur: money,
      internalNotes: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!id.safeParse(bookingId).success || !parsed.success) return { error: "Dati non validi." };
  return guard(async () => {
    const db = await getDb();
    await db
      .update(schema.bookings)
      .set({ ...parsed.data, internalNotes: parsed.data.internalNotes || null, updatedAt: Date.now() })
      .where(eq(schema.bookings.id, bookingId));
  });
}

const moveSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: isoDate,
  startTime: hhmm,
  endDate: isoDate,
  endTime: hhmm,
  notify: z.boolean().optional(),
});

/** Spostamento da calendario (drag) o dal form di modifica date. */
export async function moveBookingAction(bookingId: string, input: z.input<typeof moveSchema>): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = moveSchema.safeParse(input);
  if (!id.safeParse(bookingId).success || !parsed.success) return { error: "Dati non validi." };
  const d = parsed.data;
  const startAt = romeToUtc(d.startDate, d.startTime);
  const endAt = romeToUtc(d.endDate, d.endTime);
  if (endAt <= startAt) return { error: "La riconsegna deve essere dopo il ritiro." };
  if (endAt - startAt > MAX_RENTAL_MS) return { error: "Durata massima: un anno." };
  return guard(async () => {
    await rescheduleBooking(bookingId, { vehicleId: d.vehicleId, startAt, endAt }, d.notify ?? true);
    await audit("booking.moved", { userId: me.id, entity: "booking", entityId: bookingId, meta: { startAt, endAt, vehicleId: d.vehicleId } });
  });
}

export async function moveBookingFormAction(bookingId: string, _p: ActionResult, form: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  return moveBookingAction(bookingId, {
    vehicleId: raw.vehicleId ?? "",
    startDate: raw.startDate ?? "",
    startTime: raw.startTime ?? "",
    endDate: raw.endDate ?? "",
    endTime: raw.endTime ?? "",
    notify: raw.notify === "on",
  });
}

/** Prenotazione inserita a mano (telefono, banco) o blocco del mezzo. Nasce già confermata. */
export async function createAdminBookingAction(_p: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = adminBookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const startAt = romeToUtc(d.startDate, d.startTime);
  const endAt = romeToUtc(d.endDate, d.endTime);
  if (endAt <= startAt) return { error: "La riconsegna deve essere dopo il ritiro." };
  if (endAt - startAt > MAX_RENTAL_MS) return { error: "Durata massima: un anno." };

  const db = await getDb();
  let customerId: string | null = null;
  if (d.kind === "rental") {
    if (d.customerId) {
      const c = await db.query.customers.findFirst({ where: eq(schema.customers.id, d.customerId), columns: { id: true } });
      if (!c) return { error: "Cliente non trovato." };
      customerId = c.id;
    } else {
      if (!d.newFirstName || !d.newLastName) return { error: "Scegli un cliente o inserisci nome e cognome." };
      if (d.newEmail && !z.string().email().safeParse(d.newEmail).success) return { error: "Email del cliente non valida." };
      customerId = newId();
      await db.insert(schema.customers).values({
        id: customerId,
        firstName: d.newFirstName,
        lastName: d.newLastName,
        email: d.newEmail?.toLowerCase() ?? null,
        phone: d.newPhone,
      });
    }
  }

  let created: { id: string; code: string };
  try {
    created = await insertBookingIfFree({
      vehicleId: d.vehicleId,
      customerId,
      kind: d.kind,
      source: "admin",
      status: "confirmed",
      startAt,
      endAt,
      priceEur: d.priceEur,
      depositEur: d.depositEur,
      internalNotes: d.internalNotes,
      decidedBy: me.id,
    });
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
  await audit("booking.created", { userId: me.id, entity: "booking", entityId: created.id, meta: { kind: d.kind } });

  if (d.kind === "rental" && d.sendEmail) {
    const info = await bookingMailData(created.id);
    if (info?.email) {
      const s = await getSettings();
      await runInBackground(
        sendEmail({ to: info.email, ...bookingConfirmedMail(s, info.data), replyTo: s.email || undefined, idempotencyKey: `confirmed-${created.id}` }),
      );
    }
  }
  refresh();
  redirect(d.kind === "block" ? "/admin/calendario" : `/admin/prenotazioni/${created.id}`);
}
