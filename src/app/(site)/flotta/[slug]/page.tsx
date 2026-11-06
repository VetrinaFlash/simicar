import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/site/booking-widget";
import { Gallery } from "@/components/site/gallery";
import { busyRanges } from "@/lib/bookings";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { addDays, romeToUtc, todayRome } from "@/lib/time";
import { FUEL_LABELS, mediaUrl, vehicleName } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const db = await getDb();
  return db.query.vehicles.findFirst({
    where: and(eq(schema.vehicles.slug, slug), eq(schema.vehicles.isPublic, true), eq(schema.vehicles.status, "available")),
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await load((await params).slug);
  if (!v) return {};
  const s = await getSettings();
  const kind = v.type === "furgone" ? "Furgone" : "Auto";
  return {
    title: `${vehicleName(v)} a noleggio`,
    description: `${kind} ${vehicleName(v)} a noleggio${s.city ? ` a ${s.city}` : ""}. Verifica le date libere e invia la richiesta.`,
    alternates: { canonical: `/flotta/${v.slug}` },
  };
}

const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ dal?: string; al?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const v = await load(slug);
  if (!v) notFound();
  const db = await getDb();
  const today = todayRome();
  const [s, env, photos, busy] = await Promise.all([
    getSettings(),
    getEnv(),
    db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, v.id)).orderBy(asc(schema.vehiclePhotos.sortOrder), asc(schema.vehiclePhotos.createdAt)),
    busyRanges(v.id, romeToUtc(today), romeToUtc(addDays(today, 400))),
  ]);
  let dal = iso(sp.dal);
  let al = iso(sp.al);
  if (dal && dal < today) dal = "";
  if (!dal || (al && al < dal)) al = "";

  const specs: [string, string][] = [];
  if (v.type === "furgone") {
    if (v.cargoVolumeM3) specs.push(["Volume di carico", `${v.cargoVolumeM3.toLocaleString("it-IT")} m³`]);
    if (v.payloadKg) specs.push(["Portata", `${v.payloadKg.toLocaleString("it-IT")} kg`]);
    if (v.cargoLengthCm) specs.push(["Lunghezza vano", `${(v.cargoLengthCm / 100).toLocaleString("it-IT")} m`]);
  }
  if (v.seats) specs.push(["Posti", String(v.seats)]);
  if (v.type === "auto" && v.doors) specs.push(["Porte", String(v.doors)]);
  if (v.type === "auto" && v.luggage) specs.push(["Valigie", String(v.luggage)]);
  specs.push(["Alimentazione", FUEL_LABELS[v.fuel] ?? v.fuel]);
  specs.push(["Cambio", v.transmission === "automatico" ? "Automatico" : "Manuale"]);
  specs.push(["Patente", v.licenseRequired]);
  if (v.minDriverAge) specs.push(["Età minima", `${v.minDriverAge} anni`]);
  if (v.depositEur) specs.push(["Cauzione", `€ ${v.depositEur.toLocaleString("it-IT")}`]);

  return (
    <main className="pb-24 pt-24 md:pt-28">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <Link href={`/${dal ? `?dal=${dal}${al ? `&al=${al}` : ""}` : ""}#flotta`} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Tutta la flotta
        </Link>
        <div className="mt-6 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-red">{v.type === "furgone" ? "Furgone" : "Auto"}</p>
            <h1 className="font-narrow mt-1 text-[clamp(2.6rem,6vw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.01em] text-eu-deep">
              {v.brand} {v.model}
            </h1>
            {v.version && <p className="mt-2 text-[19px] text-ink-2">{v.version}</p>}
            {v.priceFromEur != null && (
              <p className="mt-4 text-[17px]">
                da <span className="font-wide text-[28px] font-extrabold tabular">€{v.priceFromEur}</span> al giorno
              </p>
            )}
            <div className="mt-8">
              <Gallery type={v.type} name={vehicleName(v)} photos={photos.map((p) => ({ src: mediaUrl(p.r2Key), width: p.width, height: p.height }))} />
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
              {specs.map(([k, val]) => (
                <div key={k} className="border-t border-line py-3.5">
                  <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
                  <dd className="mt-0.5 text-[18px] font-bold">{val}</dd>
                </div>
              ))}
            </dl>
            {v.features.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2">
                {v.features.map((f) => (
                  <li key={f} className="rounded-full bg-paper px-3.5 py-1.5 text-[14px] font-semibold ring-1 ring-line">{f}</li>
                ))}
              </ul>
            )}
            {v.description && <p className="mt-8 max-w-prose whitespace-pre-line text-[17px] leading-relaxed text-ink-2">{v.description}</p>}
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">
            <BookingWidget
              vehicleId={v.id}
              vehicleName={`${v.brand} ${v.model}`}
              busy={busy}
              today={today}
              openFrom={s.openFrom}
              openTo={s.openTo}
              minNoticeHours={Number(s.minNoticeHours) || 0}
              initialStart={dal}
              initialEnd={al}
              turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
