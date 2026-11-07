import type { Metadata } from "next";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/site/gallery";
import { InquiryForm } from "@/components/site/inquiry-form";
import { CONDITION_LABEL } from "@/components/site/sale-section";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { FUEL_LABELS, mediaUrl, vehicleName } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const db = await getDb();
  return db.query.vehicles.findFirst({
    where: and(eq(schema.vehicles.slug, slug), eq(schema.vehicles.isPublic, true), ne(schema.vehicles.status, "inactive"), ne(schema.vehicles.listing, "rental"), isNull(schema.vehicles.soldAt)),
  });
}

const priceLabel = (n: number | null) => (n != null ? `€ ${n.toLocaleString("it-IT")}` : "Prezzo su richiesta");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await load((await params).slug);
  if (!v) return {};
  return {
    title: `${vehicleName(v)} in vendita`,
    description: `${v.type === "furgone" ? "Furgone" : "Auto"} ${vehicleName(v)} in vendita: ${priceLabel(v.salePriceEur)}${v.mileageKm != null ? `, ${v.mileageKm.toLocaleString("it-IT")} km` : ""}.`,
    alternates: { canonical: `/vendita/${v.slug}` },
  };
}

function waHref(n: string, text: string) {
  const d = n.replace(/[^\d]/g, "");
  return `https://wa.me/${d.length <= 10 ? `39${d}` : d}?text=${encodeURIComponent(text)}`;
}

export default async function SaleVehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await load(slug);
  if (!v) notFound();
  const db = await getDb();
  const [s, env, photos] = await Promise.all([
    getSettings(),
    getEnv(),
    db.select().from(schema.vehiclePhotos).where(eq(schema.vehiclePhotos.vehicleId, v.id)).orderBy(asc(schema.vehiclePhotos.sortOrder), asc(schema.vehiclePhotos.createdAt)),
  ]);
  const name = vehicleName(v);

  const specs: [string, string][] = [];
  if (v.saleCondition) specs.push(["Condizione", CONDITION_LABEL[v.saleCondition] ?? v.saleCondition]);
  if (v.registrationDate) specs.push(["Immatricolazione", v.registrationDate.split("-").reverse().join("/")]);
  else if (v.year) specs.push(["Anno", String(v.year)]);
  if (v.mileageKm != null) specs.push(["Chilometri", `${v.mileageKm.toLocaleString("it-IT")} km`]);
  specs.push(["Alimentazione", FUEL_LABELS[v.fuel] ?? v.fuel]);
  specs.push(["Cambio", v.transmission === "automatico" ? "Automatico" : "Manuale"]);
  if (v.type === "furgone") {
    if (v.cargoVolumeM3) specs.push(["Volume di carico", `${v.cargoVolumeM3.toLocaleString("it-IT")} m³`]);
    if (v.payloadKg) specs.push(["Portata", `${v.payloadKg.toLocaleString("it-IT")} kg`]);
  }
  if (v.seats) specs.push(["Posti", String(v.seats)]);
  if (v.color) specs.push(["Colore", v.color]);

  return (
    <main className="pb-28 pt-24 md:pt-28 lg:pb-24">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <Link href="/#vendita" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Tutti i mezzi in vendita
        </Link>
        <div className="mt-6 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-red">{v.type === "furgone" ? "Furgone" : "Auto"} in vendita</p>
            <h1 className="font-narrow mt-1 text-[clamp(2.6rem,6vw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.01em] text-eu-deep">
              {v.brand} {v.model}
            </h1>
            {v.version && <p className="mt-2 text-[19px] text-ink-2">{v.version}</p>}
            <p className="mt-5 inline-flex rounded-2xl bg-red px-5 py-3 text-white">
              <span className="font-narrow text-[44px] font-black leading-none tabular">{priceLabel(v.salePriceEur)}</span>
            </p>
            <div className="mt-8">
              <Gallery type={v.type} name={name} photos={photos.map((p) => ({ src: mediaUrl(p.r2Key), width: p.width, height: p.height }))} />
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
            {v.listing === "both" && v.status === "available" && (
              <Link href={`/flotta/${v.slug}`} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-eu-soft px-4 py-3 text-[15px] font-bold text-eu-deep hover:bg-eu-soft/70">
                Vuoi provarlo prima? È disponibile anche a noleggio
              </Link>
            )}
          </div>
          <div id="contatta" className="scroll-mt-20 space-y-4 lg:sticky lg:top-24 lg:self-start">
            <InquiryForm vehicleId={v.id} vehicleName={name} turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined} />
            {(s.phone || s.whatsapp) && (
              <div className="grid grid-cols-2 gap-3">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-eu-deep text-[16px] font-bold text-white hover:bg-eu">
                    <Phone className="size-5" /> Chiama
                  </a>
                )}
                {s.whatsapp && (
                  <a
                    href={waHref(s.whatsapp, `Buongiorno, sono interessato al ${name} in vendita.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-paper text-[16px] font-bold ring-1 ring-line hover:ring-ink"
                  >
                    <MessageCircle className="size-5" /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <a
        href="#contatta"
        className="fixed inset-x-3 bottom-3 z-30 flex h-14 items-center justify-between rounded-2xl bg-red px-5 text-[16px] font-bold text-white shadow-2xl lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        Richiedi informazioni
        <span className="text-[14px] font-semibold text-white/85">{priceLabel(v.salePriceEur)}</span>
      </a>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Vehicle",
            name,
            brand: { "@type": "Brand", name: v.brand },
            model: v.model,
            ...(v.mileageKm != null && { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } }),
            ...(v.salePriceEur != null && {
              offers: { "@type": "Offer", price: v.salePriceEur, priceCurrency: "EUR", availability: "https://schema.org/InStock", seller: { "@type": "AutoDealer", name: s.businessName } },
            }),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
