import "server-only";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const DEFAULT_SETTINGS = {
  businessName: "Il tuo noleggio",
  city: "La tua città",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  notifyEmail: "",
  hours: "Lun–Sab 8:30–13:00 / 15:00–19:00",
  openFrom: "08:30",
  openTo: "19:00",
  minNoticeHours: "12",
  vatNumber: "",
  mapsUrl: "",
  heroTitle: "Auto e furgoni a noleggio, quando ti servono.",
  heroText: "Scegli il mezzo e le date: ti confermiamo la disponibilità per email, di solito in giornata.",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const getSettings = cache(async (): Promise<Settings> => {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
});

export async function saveSettings(values: Partial<Settings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS) || typeof value !== "string") continue;
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: sql`(unixepoch() * 1000)` } });
  }
}
