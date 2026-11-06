import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { adminOrNull } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { newId } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/request";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 20;

/** Riconosce il formato dai "magic bytes", non dal nome o dal content-type dichiarato. */
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { type: "image/webp", ext: "webp" };
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await adminOrNull();
  if (!user) return Response.json({ error: "Non autorizzato" }, { status: 401 });
  if (!isSameOrigin(req)) return Response.json({ error: "Origine non valida" }, { status: 403 });
  if (!(await rateLimit(`upload:${user.id}`, 60, 10 * 60_000)))
    return Response.json({ error: "Troppi caricamenti, attendi qualche minuto." }, { status: 429 });

  const { id } = await params;
  const db = await getDb();
  const vehicle = await db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id), columns: { id: true } });
  if (!vehicle) return Response.json({ error: "Veicolo non trovato" }, { status: 404 });

  const [existing] = await db.select({ n: count() }).from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, id));
  if ((existing?.n ?? 0) >= MAX_PHOTOS) return Response.json({ error: `Massimo ${MAX_PHOTOS} foto per veicolo.` }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Nessun file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Foto troppo grande (max 5 MB)." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return Response.json({ error: "Formato non supportato: usa JPG, PNG o WebP." }, { status: 415 });

  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;
  const photoId = newId();
  const key = `vehicles/${id}/${photoId}.${kind.ext}`;
  const env = await getEnv();
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type, cacheControl: "public, max-age=31536000, immutable" } });
  await db.insert(schema.vehiclePhotos).values({
    id: photoId,
    vehicleId: id,
    r2Key: key,
    width: width && width < 20000 ? Math.round(width) : null,
    height: height && height < 20000 ? Math.round(height) : null,
    sortOrder: (existing?.n ?? 0) + 1,
  });
  revalidatePath("/", "layout");
  return Response.json({ id: photoId, key });
}
