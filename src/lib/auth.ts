import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import { userAgent } from "@/lib/security/request";

export const SESSION_COOKIE = "__Host-nlg_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni
const SESSION_RENEW_MS = 7 * 24 * 60 * 60 * 1000; // rinnovo se mancano meno di 7 giorni

export type AdminUser = { id: string; email: string; name: string };

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await db.insert(schema.sessions).values({
    id: await sha256Hex(token),
    userId,
    expiresAt,
    userAgent: await userAgent(),
  });
  // Pulizia sessioni scadute (economica, indicizzata)
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now()));
  await setSessionCookie(token, expiresAt);
}

async function setSessionCookie(token: string, expiresAt: number) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Utente corrente (memorizzato per la durata della richiesta). */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const id = await sha256Hex(token);
  const rows = await db
    .select({
      expiresAt: schema.sessions.expiresAt,
      userId: schema.adminUsers.id,
      email: schema.adminUsers.email,
      name: schema.adminUsers.name,
    })
    .from(schema.sessions)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, Date.now())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt - Date.now() < SESSION_RENEW_MS) {
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await db.update(schema.sessions).set({ expiresAt }).where(eq(schema.sessions.id, id));
    try {
      await setSessionCookie(token, expiresAt);
    } catch {
      // In un Server Component i cookie non sono scrivibili: verrà rinnovato alla prossima action.
    }
  }
  return { id: row.userId, email: row.email, name: row.name };
});

/** Da usare in OGNI pagina, action e route del pannello. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Variante per le route API: niente redirect, restituisce null. */
export async function adminOrNull() {
  return getCurrentUser();
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, await sha256Hex(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = await getDb();
  const keep = token ? await sha256Hex(token) : "";
  const all = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, userId));
  for (const s of all) if (s.id !== keep) await db.delete(schema.sessions).where(eq(schema.sessions.id, s.id));
}
