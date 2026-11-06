import "server-only";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/security/crypto";
import { pushToAllAdmins } from "@/lib/push";

/** Crea una notifica nel pannello e sveglia i dispositivi con una push. */
export async function notifyAdmins(n: { type: string; title: string; body: string; url?: string }) {
  const db = await getDb();
  await db.insert(schema.notifications).values({ id: newId(), ...n });
  await pushToAllAdmins();
}
