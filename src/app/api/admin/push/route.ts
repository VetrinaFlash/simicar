import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminOrNull } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isAllowedPushEndpoint } from "@/lib/push";
import { newId } from "@/lib/security/crypto";
import { isSameOrigin } from "@/lib/security/request";

const body = z.object({ endpoint: z.string().url().max(1000) });

export async function GET() {
  const user = await adminOrNull();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  const env = await getEnv();
  return Response.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: Request) {
  const user = await adminOrNull();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "Origine non valida" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint))
    return Response.json({ error: "Abbonamento non valido" }, { status: 400 });
  const db = await getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({ id: newId(), userId: user.id, endpoint: parsed.data.endpoint, userAgent: req.headers.get("user-agent")?.slice(0, 300) })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: user.id } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await adminOrNull();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "Origine non valida" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dati non validi" }, { status: 400 });
  const db = await getDb();
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, parsed.data.endpoint));
  return Response.json({ ok: true });
}
