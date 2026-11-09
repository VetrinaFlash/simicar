"use server";

import { isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { saveSettings } from "@/lib/settings";
import { firstError, hhmm } from "@/lib/validation";

const s = (max: number) => z.string().trim().max(max);
const optEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email non valida");

const settingsSchema = z.object({
  businessName: s(80).min(1, "Inserisci il nome dell'attività"),
  city: s(60),
  address: s(200),
  phone: s(30),
  whatsapp: s(30),
  email: optEmail,
  notifyEmail: optEmail,
  hours: s(200),
  openFrom: hhmm,
  openTo: hhmm,
  minNoticeHours: z.coerce.number().int().min(0).max(240).transform(String),
  vatNumber: s(30),
  mapsUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Il link a Maps deve iniziare con https://"),
  heroTitle: s(120).min(1, "Inserisci il titolo"),
  heroText: s(300),
  cargosAgencyId: s(30),
  cargosAgencyPlaceCode: z.string().trim().regex(/^(\d{9})?$/, "Scegli il comune della sede dall'elenco"),
  cargosAgencyPlaceName: s(80),
  cargosPaymentType: z.enum(["0", "1", "2", "3", "4", "9"]),
  cargosAutoSend: z
    .string()
    .optional()
    .transform((v) => (v === "on" ? "1" : "0")),
});

export type SettingsState = { error?: string; ok?: boolean };

export async function saveSettingsAction(_p: SettingsState, form: FormData): Promise<SettingsState> {
  const me = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.openFrom >= parsed.data.openTo) return { error: "L'orario di apertura deve precedere la chiusura." };
  await saveSettings(parsed.data);
  await audit("settings.updated", { userId: me.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  await requireAdmin();
  const db = await getDb();
  await db.update(schema.notifications).set({ readAt: Date.now() }).where(isNull(schema.notifications.readAt));
  revalidatePath("/admin", "layout");
}

/** Elimina tutti i dati dimostrativi (id che iniziano con de000000-). */
export async function removeDemoDataAction() {
  const me = await requireAdmin();
  const { getEnv } = await import("@/lib/env");
  const env = await getEnv();
  const like = "de000000-%";
  await env.DB.batch([
    env.DB.prepare("DELETE FROM notifications WHERE id LIKE ?").bind(like),
    env.DB.prepare("DELETE FROM bookings WHERE id LIKE ? OR vehicle_id LIKE ? OR customer_id LIKE ?").bind(like, like, like),
    env.DB.prepare("DELETE FROM customers WHERE id LIKE ?").bind(like),
    env.DB.prepare("DELETE FROM sale_inquiries WHERE vehicle_id LIKE ?").bind(like),
    env.DB.prepare("DELETE FROM vehicle_photos WHERE vehicle_id LIKE ?").bind(like),
    env.DB.prepare("DELETE FROM vehicles WHERE id LIKE ?").bind(like),
  ]);
  await audit("demo.removed", { userId: me.id });
  revalidatePath("/", "layout");
}

export type TestPushResult = { lines: { ok: boolean; text: string }[] };

/** Notifica di prova con diagnosi, per capire subito dove si blocca. */
export async function testPushAction(): Promise<TestPushResult> {
  await requireAdmin();
  const { getEnv } = await import("@/lib/env");
  const { sendPushes, vapidPairOk } = await import("@/lib/push");
  const { newId } = await import("@/lib/security/crypto");
  const env = await getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
    return { lines: [{ ok: false, text: "Mancano i Secret VAPID_PUBLIC_KEY e/o VAPID_PRIVATE_KEY su Cloudflare." }] };
  const pair = await vapidPairOk();
  if (pair === false)
    return {
      lines: [{ ok: false, text: "VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY non sono della stessa coppia: ricopia entrambe dallo stesso blocco generato, poi riattiva le notifiche sui telefoni." }],
    };
  const db = await getDb();
  await db.insert(schema.notifications).values({
    id: newId(),
    type: "test",
    title: "Notifica di prova",
    body: "Se la vedi, le notifiche funzionano su questo dispositivo.",
    url: "/admin/impostazioni",
  });
  const results = await sendPushes();
  revalidatePath("/admin", "layout");
  if (results.length === 0)
    return { lines: [{ ok: false, text: "Nessun dispositivo registrato. Premi «Attiva su questo dispositivo» qui sopra e riprova." }] };
  const explain = (st: number) =>
    st === 403
      ? "il dispositivo era stato attivato con chiavi diverse: è stato rimosso, riattiva le notifiche"
      : st === 404 || st === 410
        ? "attivazione scaduta: è stata rimossa, riattiva le notifiche"
        : st === 401
          ? "firma rifiutata: controlla VAPID_SUBJECT e le chiavi"
          : st === 0
            ? "errore di rete"
            : `errore ${st}`;
  return {
    lines: results.map((r) => ({
      ok: r.ok,
      text: `${r.service}${r.device ? ` (${/Android/i.test(r.device) ? "Android" : /iPhone|iPad/i.test(r.device) ? "iPhone" : /Windows/i.test(r.device) ? "Windows" : /Mac/i.test(r.device) ? "Mac" : "dispositivo"})` : ""}: ${r.ok ? "inviata" : explain(r.status)}`,
    })),
  };
}
