"use server";

import { and, asc, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { newId } from "@/lib/security/crypto";
import { firstError, vehicleSchema } from "@/lib/validation";
import { slugify } from "@/lib/vehicles";

export type VehicleFormState = { error?: string; ok?: boolean };

async function uniqueSlug(base: string, excludeId?: string) {
  const db = await getDb();
  const root = slugify(base) || "veicolo";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.query.vehicles.findFirst({
      where: excludeId ? and(eq(schema.vehicles.slug, slug), ne(schema.vehicles.id, excludeId)) : eq(schema.vehicles.slug, slug),
      columns: { id: true },
    });
    if (!clash) return slug;
  }
  return `${root}-${newId().slice(0, 6)}`;
}

function plateTaken(err: unknown) {
  return String(err).includes("vehicles.plate") || String(err).includes("UNIQUE");
}

export async function createVehicleAction(_prev: VehicleFormState, form: FormData): Promise<VehicleFormState> {
  const me = await requireAdmin();
  const parsed = vehicleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const id = newId();
  const d = parsed.data;
  try {
    await db.insert(schema.vehicles).values({
      id,
      ...d,
      slug: await uniqueSlug(`${d.brand} ${d.model} ${d.version ?? ""}`),
    });
  } catch (err) {
    if (plateTaken(err)) return { error: "Esiste già un veicolo con questa targa." };
    throw err;
  }
  await audit("vehicle.created", { userId: me.id, entity: "vehicle", entityId: id, meta: { plate: d.plate } });
  revalidatePath("/", "layout");
  redirect(`/admin/flotta/${id}?nuovo=1`);
}

export async function updateVehicleAction(id: string, _prev: VehicleFormState, form: FormData): Promise<VehicleFormState> {
  const me = await requireAdmin();
  const parsed = vehicleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const d = parsed.data;
  try {
    const res = await db
      .update(schema.vehicles)
      .set({ ...d, slug: await uniqueSlug(`${d.brand} ${d.model} ${d.version ?? ""}`, id), updatedAt: Date.now() })
      .where(eq(schema.vehicles.id, id))
      .returning({ id: schema.vehicles.id });
    if (!res.length) return { error: "Veicolo non trovato." };
  } catch (err) {
    if (plateTaken(err)) return { error: "Esiste già un veicolo con questa targa." };
    throw err;
  }
  await audit("vehicle.updated", { userId: me.id, entity: "vehicle", entityId: id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteVehicleAction(id: string) {
  const me = await requireAdmin();
  const db = await getDb();
  const [used] = await db.select({ n: count() }).from(schema.bookings).where(eq(schema.bookings.vehicleId, id));
  if ((used?.n ?? 0) > 0) {
    // Ha uno storico: non si cancella, si disattiva (le prenotazioni passate restano coerenti)
    await db.update(schema.vehicles).set({ status: "inactive", isPublic: false, updatedAt: Date.now() }).where(eq(schema.vehicles.id, id));
    await audit("vehicle.deactivated", { userId: me.id, entity: "vehicle", entityId: id });
  } else {
    const env = await getEnv();
    const photos = await db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, id));
    if (photos.length) await env.MEDIA.delete(photos.map((p) => p.r2Key));
    await db.delete(schema.vehicles).where(eq(schema.vehicles.id, id));
    await audit("vehicle.deleted", { userId: me.id, entity: "vehicle", entityId: id });
  }
  revalidatePath("/", "layout");
  redirect("/admin/flotta");
}

export async function deletePhotoAction(photoId: string) {
  await requireAdmin();
  const db = await getDb();
  const photo = await db.query.vehiclePhotos.findFirst({ where: eq(schema.vehiclePhotos.id, photoId) });
  if (!photo) return;
  const env = await getEnv();
  await env.MEDIA.delete(photo.r2Key);
  await db.delete(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.id, photoId));
  revalidatePath("/", "layout");
}

/** Sposta una foto in prima posizione (copertina). */
export async function setCoverPhotoAction(photoId: string) {
  await requireAdmin();
  const db = await getDb();
  const photo = await db.query.vehiclePhotos.findFirst({ where: eq(schema.vehiclePhotos.id, photoId) });
  if (!photo) return;
  const all = await db
    .select({ id: schema.vehiclePhotos.id })
    .from(schema.vehiclePhotos)
    .where(eq(schema.vehiclePhotos.vehicleId, photo.vehicleId))
    .orderBy(asc(schema.vehiclePhotos.sortOrder), asc(schema.vehiclePhotos.createdAt));
  const ordered = [photoId, ...all.map((p) => p.id).filter((id) => id !== photoId)];
  await Promise.all(
    ordered.map((id, i) => db.update(schema.vehiclePhotos).set({ sortOrder: i }).where(eq(schema.vehiclePhotos.id, id))),
  );
  revalidatePath("/", "layout");
}

export async function reorderVehiclesAction(ids: string[]) {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.length > 500) return;
  const db = await getDb();
  await Promise.all(
    ids.map((id, i) =>
      typeof id === "string" ? db.update(schema.vehicles).set({ sortOrder: i }).where(eq(schema.vehicles.id, id)) : null,
    ),
  );
  revalidatePath("/", "layout");
}
