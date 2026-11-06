import "server-only";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { cache } from "react";
import { OCCUPYING } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { FUEL_LABELS, vehicleName } from "@/lib/vehicles";

export type PublicVehicle = {
  id: string;
  slug: string;
  type: "auto" | "furgone";
  name: string;
  brand: string;
  model: string;
  specs: string[];
  priceFromEur: number | null;
  photos: { key: string; width: number | null; height: number | null }[];
  busy?: boolean;
};

/** Specifiche sintetiche mostrate sulle card. */
export function shortSpecs(v: typeof schema.vehicles.$inferSelect): string[] {
  const out: string[] = [];
  if (v.type === "furgone") {
    if (v.cargoVolumeM3) out.push(`${v.cargoVolumeM3.toLocaleString("it-IT")} m³`);
    if (v.payloadKg) out.push(`${v.payloadKg.toLocaleString("it-IT")} kg`);
    if (v.seats) out.push(`${v.seats} posti`);
  } else {
    if (v.seats) out.push(`${v.seats} posti`);
    out.push(v.transmission === "automatico" ? "Automatico" : "Manuale");
  }
  out.push(FUEL_LABELS[v.fuel] ?? v.fuel);
  return out;
}

export const getPublicVehicles = cache(async (): Promise<PublicVehicle[]> => {
  const db = await getDb();
  const vehicles = await db
    .select()
    .from(schema.vehicles)
    .where(and(eq(schema.vehicles.isPublic, true), eq(schema.vehicles.status, "available")))
    .orderBy(asc(schema.vehicles.sortOrder), asc(schema.vehicles.brand));
  const ids = vehicles.map((v) => v.id);
  const photos = ids.length
    ? await db.select().from(schema.vehiclePhotos).where(inArray(schema.vehiclePhotos.vehicleId, ids)).orderBy(asc(schema.vehiclePhotos.sortOrder), asc(schema.vehiclePhotos.createdAt))
    : [];
  return vehicles.map((v) => ({
    id: v.id,
    slug: v.slug,
    type: v.type,
    name: vehicleName(v),
    brand: v.brand,
    model: v.model,
    specs: shortSpecs(v),
    priceFromEur: v.priceFromEur,
    photos: photos.filter((p) => p.vehicleId === v.id).map((p) => ({ key: p.r2Key, width: p.width, height: p.height })),
  }));
});

/** Id dei veicoli occupati (anche parzialmente) nell'intervallo. */
export async function busyVehicleIds(from: number, to: number): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ id: schema.bookings.vehicleId })
    .from(schema.bookings)
    .where(and(inArray(schema.bookings.status, [...OCCUPYING]), lt(schema.bookings.startAt, to), gt(schema.bookings.endAt, from)));
  return new Set(rows.map((r) => r.id));
}
