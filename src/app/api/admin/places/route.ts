import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { adminOrNull } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

/** Ricerca nella tabella luoghi CaRGOS (comuni italiani e stati esteri). */
export async function GET(req: Request) {
  if (!(await adminOrNull())) return Response.json({ items: [] }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toUpperCase().replace(/[%_]/g, "").slice(0, 40);
  const kind = url.searchParams.get("kind");
  if (q.length < 2) return Response.json({ items: [] });
  const db = await getDb();
  const items = await db
    .select({ code: schema.cargosPlaces.code, name: schema.cargosPlaces.name, province: schema.cargosPlaces.province, kind: schema.cargosPlaces.kind })
    .from(schema.cargosPlaces)
    .where(
      and(
        or(like(schema.cargosPlaces.name, `${q}%`), like(schema.cargosPlaces.name, `% ${q}%`)),
        kind === "stato" || kind === "comune" ? eq(schema.cargosPlaces.kind, kind) : undefined,
      ),
    )
    // Prima le corrispondenze esatte, poi quelle che iniziano con il testo
    .orderBy(sql`CASE WHEN ${schema.cargosPlaces.name} = ${q} THEN 0 WHEN ${schema.cargosPlaces.name} LIKE ${`${q}%`} THEN 1 ELSE 2 END`, asc(schema.cargosPlaces.name))
    .limit(12);
  return Response.json({ items }, { headers: { "cache-control": "private, max-age=3600" } });
}
