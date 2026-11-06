import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { adminOrNull } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { cargosPdf, contractPdf } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await adminOrNull();
  if (!user) return new Response("Non autorizzato", { status: 401 });
  const { id } = await params;
  const tipo = new URL(req.url).searchParams.get("tipo") === "cargos" ? "cargos" : "contratto";
  const db = await getDb();
  const row = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, id))
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.b.kind !== "rental") return new Response("Non trovato", { status: 404 });

  const env = await getEnv();
  let logo: Uint8Array | null = null;
  try {
    const res = await env.ASSETS.fetch(new URL("/brand/manhattan-logo-96.png", req.url).toString());
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    logo = null;
  }
  const data = { ...row, s: await getSettings(), logo };
  const bytes = tipo === "cargos" ? await cargosPdf(data) : await contractPdf(data);
  await audit(`pdf.${tipo}`, { userId: user.id, entity: "booking", entityId: id });
  const name = `${tipo === "cargos" ? "cargos" : "contratto"}-${row.b.code}.pdf`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
