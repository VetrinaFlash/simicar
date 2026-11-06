import "server-only";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/security/crypto";
import { ipHash } from "@/lib/security/request";

export async function audit(
  action: string,
  opts: { userId?: string | null; entity?: string; entityId?: string; meta?: Record<string, unknown> } = {},
) {
  try {
    const db = await getDb();
    await db.insert(schema.auditLog).values({
      id: newId(),
      action,
      userId: opts.userId ?? null,
      entity: opts.entity,
      entityId: opts.entityId,
      meta: opts.meta,
      ipHash: await ipHash(),
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
