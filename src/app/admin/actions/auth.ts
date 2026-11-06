"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, destroyOtherSessions, destroySession, requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, hashPassword, sha256Hex, verifyPassword } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash } from "@/lib/security/request";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Inserisci email e password." };
  const { email, password } = parsed.data;

  const ip = await ipHash();
  const okIp = await rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
  const okEmail = await rateLimit(`login:email:${(await sha256Hex(email)).slice(0, 24)}`, 8, 15 * 60_000);
  if (!okIp || !okEmail) {
    await audit("login.rate_limited", { meta: { email } });
    return { error: "Troppi tentativi. Riprova tra 15 minuti." };
  }

  const db = await getDb();
  const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) });
  // Verifica sempre una password, anche se l'utente non esiste: tempi di risposta uguali.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    await audit("login.failed", { meta: { email } });
    return { error: "Email o password non corrette." };
  }

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

const pwSchema = z
  .object({
    current: z.string().min(1, "Inserisci la password attuale").max(200),
    next: z.string().min(12, "La nuova password deve avere almeno 12 caratteri").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Le due password non coincidono", path: ["confirm"] });

export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const me = await requireAdmin();
  const parsed = pwSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await rateLimit(`pw:${me.id}`, 5, 15 * 60_000))) return { error: "Troppi tentativi. Riprova più tardi." };
  const db = await getDb();
  const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, me.id) });
  if (!user || !(await verifyPassword(parsed.data.current, user.passwordHash)))
    return { error: "La password attuale non è corretta." };
  await db
    .update(schema.adminUsers)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(schema.adminUsers.id, me.id));
  await destroyOtherSessions(me.id);
  await audit("password.changed", { userId: me.id });
  return { ok: true };
}
