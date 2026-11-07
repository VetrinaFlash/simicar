"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

const uuid = z.string().uuid();

export async function setInquiryStatusAction(inquiryId: string, status: "new" | "contacted" | "closed") {
  const me = await requireAdmin();
  if (!uuid.safeParse(inquiryId).success || !["new", "contacted", "closed"].includes(status)) return;
  const db = await getDb();
  await db.update(schema.saleInquiries).set({ status, updatedAt: Date.now() }).where(eq(schema.saleInquiries.id, inquiryId));
  await audit("inquiry.status", { userId: me.id, entity: "inquiry", entityId: inquiryId, meta: { status } });
  revalidatePath("/admin", "layout");
}

/** Venduto: il mezzo esce dal sito e dal noleggio, ma resta nello storico. */
export async function markSoldAction(vehicleId: string, sold: boolean) {
  const me = await requireAdmin();
  if (!uuid.safeParse(vehicleId).success) return;
  const db = await getDb();
  await db
    .update(schema.vehicles)
    .set(
      sold
        ? { soldAt: Date.now(), status: "inactive", isPublic: false, updatedAt: Date.now() }
        : { soldAt: null, status: "available", isPublic: true, updatedAt: Date.now() },
    )
    .where(eq(schema.vehicles.id, vehicleId));
  await audit(sold ? "vehicle.sold" : "vehicle.unsold", { userId: me.id, entity: "vehicle", entityId: vehicleId });
  revalidatePath("/", "layout");
}
