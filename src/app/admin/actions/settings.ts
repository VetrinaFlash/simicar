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
    env.DB.prepare("DELETE FROM vehicle_photos WHERE vehicle_id LIKE ?").bind(like),
    env.DB.prepare("DELETE FROM vehicles WHERE id LIKE ?").bind(like),
  ]);
  await audit("demo.removed", { userId: me.id });
  revalidatePath("/", "layout");
}
