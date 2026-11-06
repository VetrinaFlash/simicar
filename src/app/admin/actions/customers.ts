"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/security/crypto";
import { customerSchema, firstError } from "@/lib/validation";

export type CustomerFormState = { error?: string; ok?: boolean };

export async function createCustomerAction(_p: CustomerFormState, form: FormData): Promise<CustomerFormState> {
  const me = await requireAdmin();
  const parsed = customerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const id = newId();
  await db.insert(schema.customers).values({ id, ...parsed.data });
  await audit("customer.created", { userId: me.id, entity: "customer", entityId: id });
  redirect(`/admin/clienti/${id}`);
}

export async function updateCustomerAction(id: string, _p: CustomerFormState, form: FormData): Promise<CustomerFormState> {
  const me = await requireAdmin();
  const parsed = customerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db.update(schema.customers).set({ ...parsed.data, updatedAt: Date.now() }).where(eq(schema.customers.id, id));
  await audit("customer.updated", { userId: me.id, entity: "customer", entityId: id });
  revalidatePath(`/admin/clienti/${id}`);
  return { ok: true };
}

/** Diritto all'oblio (GDPR): cancella i dati personali mantenendo lo storico dei noleggi. */
export async function anonymizeCustomerAction(id: string) {
  const me = await requireAdmin();
  const db = await getDb();
  await db
    .update(schema.customers)
    .set({
      firstName: "Cliente",
      lastName: "anonimizzato",
      email: null,
      phone: null,
      birthDate: null,
      birthPlace: null,
      taxCode: null,
      address: null,
      licenseNumber: null,
      licenseExpiry: null,
      docType: null,
      docNumber: null,
      docExpiry: null,
      notes: null,
      blacklistReason: null,
      updatedAt: Date.now(),
    })
    .where(eq(schema.customers.id, id));
  await db.update(schema.bookings).set({ customerNotes: null }).where(eq(schema.bookings.customerId, id));
  await audit("customer.anonymized", { userId: me.id, entity: "customer", entityId: id });
  revalidatePath("/admin", "layout");
}
