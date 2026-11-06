import { DAY_MS } from "@/lib/time";

export const FUEL_LABELS: Record<string, string> = {
  benzina: "Benzina",
  diesel: "Diesel",
  ibrida: "Ibrida",
  elettrica: "Elettrica",
  gpl: "GPL",
  metano: "Metano",
};
export const TRANSMISSION_LABELS: Record<string, string> = { manuale: "Manuale", automatico: "Automatico" };
export const STATUS_LABELS: Record<string, string> = {
  available: "Disponibile",
  maintenance: "In officina",
  inactive: "Non attivo",
};

export function vehicleName(v: { brand: string; model: string; version?: string | null }) {
  return [v.brand, v.model, v.version].filter(Boolean).join(" ");
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Le foto caricate stanno su R2 (/media/...); quelle demo sono file statici (/demo/...). */
export function mediaUrl(key: string) {
  return key.startsWith("demo/") ? `/${key}` : `/media/${key}`;
}

/** Scadenze della flotta entro N giorni (o già scadute). */
export function expiringItems(
  v: { insuranceExpiry: string | null; revisionExpiry: string | null; taxExpiry: string | null; serviceDueDate: string | null },
  withinDays = 30,
) {
  const items: { label: string; date: string; daysLeft: number }[] = [];
  const check = (label: string, date: string | null) => {
    if (!date) return;
    const daysLeft = Math.ceil((Date.parse(`${date}T12:00:00Z`) - Date.now()) / DAY_MS);
    if (daysLeft <= withinDays) items.push({ label, date, daysLeft });
  };
  check("Assicurazione", v.insuranceExpiry);
  check("Revisione", v.revisionExpiry);
  check("Bollo", v.taxExpiry);
  check("Tagliando", v.serviceDueDate);
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}
