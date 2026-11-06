"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, destroySession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { FIXED_ADMIN_EMAIL, FIXED_ADMIN_USERNAME } from "@/lib/fixed-admin";
import { hashPassword, newId, sha256Hex, timingSafeEqual } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash } from "@/lib/security/request";

export type LoginState = { error?: string };

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

/**
 * Login amministratore con username fisso.
 * La password vive esclusivamente nel Secret ADMIN_PASSWORD del Worker.
 * L'utente D1 viene creato soltanto al primo accesso autenticato.
 */
export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Inserisci username e password." };
  const { username, password } = parsed.data;

  const ip = await ipHash();
  const okIp = await rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
  const okUsername = await rateLimit(`login:user:${(await sha256Hex(username)).slice(0, 24)}`, 8, 15 * 60_000);
  if (!okIp || !okUsername) {
    await audit("login.rate_limited", { meta: { username } });
    return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  }

  const env = await getEnv();
  const secret = env.ADMIN_PASSWORD;
  if (!secret || secret.length < 8) return { error: "Secret ADMIN_PASSWORD non disponibile nel Worker. Verifica Variables and Secrets e ridistribuisci." };

  // Il confronto temporale costante evita differenze osservabili tra credenziali sbagliate.
  const usernameOk = timingSafeEqual(username, FIXED_ADMIN_USERNAME);
  const passwordOk = timingSafeEqual(password, secret);
  if (!usernameOk || !passwordOk) {
    await audit("login.failed", { meta: { username } });
    return { error: "Username o password non corretti." };
  }

  const db = await getDb();
  let user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, FIXED_ADMIN_EMAIL) });
  if (!user) {
    await db
      .insert(schema.adminUsers)
      .values({
        id: newId(),
        name: "Manhattan",
        email: FIXED_ADMIN_EMAIL,
        passwordHash: await hashPassword(password),
      })
      .onConflictDoNothing({ target: schema.adminUsers.email });
    user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, FIXED_ADMIN_EMAIL) });
  }
  if (!user) return { error: "Impossibile inizializzare l'account amministratore." };

  await createSession(user.id);
  await db.update(schema.adminUsers).set({ lastLoginAt: Date.now() }).where(eq(schema.adminUsers.id, user.id));
  await audit("login.success", { userId: user.id });
  const next = parsed.data.next;
  redirect(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

export type PasswordState = { error?: string; ok?: boolean };

/** Le credenziali fisse si gestiscono esclusivamente nei Secret del Worker. */
export async function changePasswordAction(_prev: PasswordState, _form: FormData): Promise<PasswordState> {
  return { error: "La password è gestita dal Secret ADMIN_PASSWORD su Cloudflare. Modificala lì." };
}
