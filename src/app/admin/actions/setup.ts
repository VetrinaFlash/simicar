"use server";

import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { hashPassword, newId, timingSafeEqual } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash } from "@/lib/security/request";

export type SetupState = { error?: string };

const schemaSetup = z
  .object({
    token: z.string().min(1).max(200),
    name: z.string().trim().min(1, "Inserisci il nome").max(60),
    email: z.string().trim().toLowerCase().email("Email non valida").max(160),
    password: z.string().min(12, "La password deve avere almeno 12 caratteri").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Le password non coincidono" });

/** Primo accesso: crea il titolare. Funziona SOLO se non esiste ancora nessun utente e con il codice segreto. */
export async function setupAction(_p: SetupState, form: FormData): Promise<SetupState> {
  if (!(await rateLimit(`setup:${await ipHash()}`, 5, 30 * 60_000))) return { error: "Troppi tentativi. Riprova più tardi." };
  const env = await getEnv();
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(schema.adminUsers);
  if ((row?.n ?? 0) > 0) return { error: "Il pannello è già configurato. Accedi con il tuo account." };
  const parsed = schemaSetup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const expected = env.ADMIN_SETUP_TOKEN;
  if (!expected || expected.length < 16 || !timingSafeEqual(parsed.data.token, expected)) {
    await audit("setup.bad_token");
    return { error: "Codice di attivazione non valido." };
  }
  const id = newId();
  await db.insert(schema.adminUsers).values({ id, name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) });
  await audit("setup.completed", { userId: id });
  await createSession(id);
  redirect("/admin");
}
