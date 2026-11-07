"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { BookingError, insertBookingIfFree } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { getEnv, runInBackground } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { adminNewRequestMail, adminSaleInquiryMail, requestReceivedMail } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/notify";
import { newId, sha256Hex } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash } from "@/lib/security/request";
import { getSettings } from "@/lib/settings";
import { fmtDateTime, romeToUtc } from "@/lib/time";
import { verifyTurnstile } from "@/lib/turnstile";
import { MAX_RENTAL_MS, bookingRequestSchema, saleInquirySchema } from "@/lib/validation";
import { vehicleName } from "@/lib/vehicles";

export type RequestState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  code?: string;
  email?: string;
};

export async function requestBookingAction(_prev: RequestState, form: FormData): Promise<RequestState> {
  const parsed = bookingRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k === "website") return { ok: true, code: "———" }; // bot: risposta finta, nessun salvataggio
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Controlla i campi evidenziati.", fieldErrors };
  }
  const d = parsed.data;

  const ip = await ipHash();
  const emailKey = (await sha256Hex(d.email)).slice(0, 24);
  if (!(await rateLimit(`req:ip:${ip}`, 6, 60 * 60_000)) || !(await rateLimit(`req:email:${emailKey}`, 4, 60 * 60_000))) {
    return { error: "Hai inviato troppe richieste. Riprova tra un'ora o chiamaci." };
  }
  if (!(await verifyTurnstile(d.turnstileToken))) {
    return { error: "Verifica anti-spam non riuscita. Ricarica la pagina e riprova." };
  }

  const s = await getSettings();
  const startAt = romeToUtc(d.startDate, d.startTime);
  const endAt = romeToUtc(d.endDate, d.endTime);
  const minNotice = Math.max(0, Number(s.minNoticeHours) || 0) * 3_600_000;
  if (startAt < Date.now() + minNotice)
    return { error: `Le richieste vanno fatte con almeno ${s.minNoticeHours} ore di anticipo. Per urgenze chiamaci.`, fieldErrors: { startDate: "Troppo presto" } };
  if (endAt <= startAt) return { error: "La riconsegna deve essere dopo il ritiro.", fieldErrors: { endDate: "Controlla la data" } };
  if (endAt - startAt > MAX_RENTAL_MS) return { error: "Per noleggi oltre un anno contattaci direttamente." };
  const inHours = (t: string) => t >= s.openFrom && t <= s.openTo;
  if (!inHours(d.startTime) || !inHours(d.endTime))
    return { error: `Ritiri e riconsegne sono possibili dalle ${s.openFrom} alle ${s.openTo}.` };

  const db = await getDb();
  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(schema.vehicles.id, d.vehicleId), eq(schema.vehicles.isPublic, true), eq(schema.vehicles.status, "available"), ne(schema.vehicles.listing, "sale")),
  });
  if (!vehicle) return { error: "Questo mezzo non è più prenotabile online." };

  // Cliente: riusa l'anagrafica se email e nome coincidono, senza mai modificarla dal sito.
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(schema.customers.email, d.email),
      sql`lower(${schema.customers.firstName}) = ${d.firstName.toLowerCase()}`,
      sql`lower(${schema.customers.lastName}) = ${d.lastName.toLowerCase()}`,
    ),
  });
  const customerId = existing?.id ?? newId();
  if (!existing) {
    await db.insert(schema.customers).values({ id: customerId, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone });
  }

  let created: { id: string; code: string };
  try {
    created = await insertBookingIfFree({
      vehicleId: vehicle.id,
      customerId,
      kind: "rental",
      source: "web",
      status: "pending",
      startAt,
      endAt,
      customerNotes: d.phone !== existing?.phone && existing ? `${d.notes ?? ""}\nTelefono indicato: ${d.phone}`.trim() : d.notes,
      depositEur: vehicle.depositEur,
    });
  } catch (err) {
    if (err instanceof BookingError)
      return { error: "Il mezzo risulta già occupato in quelle date. Prova altre date o un altro mezzo.", fieldErrors: { startDate: "Non disponibile" } };
    throw err;
  }
  if (existing?.blacklisted) {
    await audit("request.blacklisted_customer", { entity: "booking", entityId: created.id });
  }

  const env = await getEnv();
  const name = vehicleName(vehicle);
  const mailData = { code: created.code, firstName: d.firstName, vehicleName: name, startAt, endAt, depositEur: vehicle.depositEur };
  const adminTo = s.notifyEmail || s.email;
  const url = new URL(`/admin/prenotazioni/${created.id}`, env.PUBLIC_SITE_URL).toString();

  await runInBackground(
    Promise.all([
      sendEmail({ to: d.email, ...requestReceivedMail(s, mailData), replyTo: s.email || undefined, idempotencyKey: `received-${created.id}` }),
      adminTo
        ? sendEmail({
            to: adminTo,
            ...adminNewRequestMail(s, { ...mailData, customer: `${d.firstName} ${d.lastName}`, phone: d.phone, url }),
            replyTo: d.email,
            idempotencyKey: `admin-${created.id}`,
          })
        : Promise.resolve(),
      notifyAdmins({
        type: "booking.request",
        title: `Nuova richiesta: ${name}`,
        body: `${d.firstName} ${d.lastName} · ${fmtDateTime(startAt)}${existing?.blacklisted ? " · ⚠ cliente in lista nera" : ""}`,
        url: `/admin/prenotazioni/${created.id}`,
      }),
    ]),
  );

  revalidatePath("/admin", "layout");
  return { ok: true, code: created.code, email: d.email };
}

export type InquiryState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Richiesta di informazioni per un mezzo in vendita. */
export async function saleInquiryAction(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  const parsed = saleInquirySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k === "website") return { ok: true }; // bot
      if (!fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { error: "Controlla i campi evidenziati.", fieldErrors };
  }
  const d = parsed.data;
  const ip = await ipHash();
  if (!(await rateLimit(`inq:ip:${ip}`, 6, 60 * 60_000))) return { error: "Hai inviato troppe richieste. Riprova tra un'ora o chiamaci." };
  if (!(await verifyTurnstile(d.turnstileToken))) return { error: "Verifica anti-spam non riuscita. Ricarica la pagina e riprova." };

  const db = await getDb();
  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(schema.vehicles.id, d.vehicleId), eq(schema.vehicles.isPublic, true), ne(schema.vehicles.listing, "rental"), isNull(schema.vehicles.soldAt)),
  });
  if (!vehicle) return { error: "Questo mezzo non è più in vendita." };

  const id = newId();
  await db.insert(schema.saleInquiries).values({ id, vehicleId: vehicle.id, name: d.name, phone: d.phone, email: d.email, message: d.message });

  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  const name = vehicleName(vehicle);
  const price = vehicle.salePriceEur != null ? `€ ${vehicle.salePriceEur.toLocaleString("it-IT")}` : "prezzo su richiesta";
  const adminTo = s.notifyEmail || s.email;
  await runInBackground(
    Promise.all([
      adminTo
        ? sendEmail({
            to: adminTo,
            ...adminSaleInquiryMail(s, { vehicleName: name, price, name: d.name, phone: d.phone, email: d.email, message: d.message, url: new URL("/admin/vendite", env.PUBLIC_SITE_URL).toString() }),
            replyTo: d.email ?? undefined,
            idempotencyKey: `inquiry-${id}`,
          })
        : Promise.resolve(),
      notifyAdmins({ type: "sale.inquiry", title: `Interesse per ${name}`, body: `${d.name} · ${d.phone}`, url: "/admin/vendite" }),
    ]),
  );
  revalidatePath("/admin", "layout");
  return { ok: true };
}
