import { MapPin, MessageCircle, Phone } from "lucide-react";
import { Fleet } from "@/components/site/fleet";
import { Hero } from "@/components/site/hero";
import { busyVehicleIds, getPublicVehicles } from "@/lib/public";
import { getSettings } from "@/lib/settings";
import { fmtIsoDate, romeToUtc, todayRome } from "@/lib/time";

export const dynamic = "force-dynamic";

const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

function waHref(n: string) {
  const d = n.replace(/[^\d]/g, "");
  return `https://wa.me/${d.length <= 10 ? `39${d}` : d}`;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tipo?: string; dal?: string; al?: string }> }) {
  const sp = await searchParams;
  const tipo = sp.tipo === "auto" || sp.tipo === "furgone" ? sp.tipo : "";
  const today = todayRome();
  let dal = iso(sp.dal);
  let al = iso(sp.al);
  if (dal && dal < today) dal = today;
  if (dal && al && al < dal) al = "";
  if (dal && !al) al = dal;

  const [s, all] = await Promise.all([getSettings(), getPublicVehicles()]);
  const busy = dal ? await busyVehicleIds(romeToUtc(dal, s.openFrom), romeToUtc(al, s.openTo)) : new Set<string>();
  const vehicles = all
    .filter((v) => !tipo || v.type === tipo)
    .map((v) => ({ ...v, busy: busy.has(v.id) }))
    .sort((a, b) => Number(a.busy) - Number(b.busy));

  const q = new URLSearchParams();
  if (dal) q.set("dal", dal);
  if (al) q.set("al", al);
  const rangeLabel = dal ? (dal === al ? `il ${fmtIsoDate(dal)}` : `dal ${fmtIsoDate(dal)} al ${fmtIsoDate(al)}`) : null;

  return (
    <main>
      <Hero
        title={s.heroTitle}
        text={s.heroText}
        city={s.city}
        today={today}
        initial={{ tipo, dal, al: dal === al && !sp.al ? "" : al }}
        hasCars={all.some((v) => v.type === "auto")}
        hasVans={all.some((v) => v.type === "furgone")}
      />

      <Fleet vehicles={vehicles} query={q.size ? `?${q}` : ""} rangeLabel={rangeLabel} />

      {/* Come funziona: è una sequenza reale, per questo è numerata */}
      <section className="border-y border-line bg-paper py-16 md:py-24">
        <div className="mx-auto max-w-[1320px] px-5 md:px-8">
          <h2 className="font-narrow max-w-3xl text-[clamp(2.2rem,4.4vw,3.8rem)] font-black uppercase leading-[0.92] text-eu-deep">
            Niente pagamenti online. Prima ti confermiamo, poi ritiri.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              { t: "Invia la richiesta", d: "Scegli il mezzo, le date e gli orari. Ci vuole un minuto." },
              { t: "Ricevi la conferma", d: `Controlliamo la disponibilità e ti rispondiamo per email${s.phone ? " o al telefono" : ""}.` },
              { t: "Passa a ritirarlo", d: "Porta patente e documento d'identità. Il resto lo sistemiamo al banco." },
            ].map((step, i) => (
              <li key={step.t} className="relative border-t-4 border-eu-deep pt-5">
                <span className="font-narrow text-[28px] font-black text-red tabular">{i + 1}</span>
                <h3 className="mt-2 text-[22px] font-extrabold tracking-tight">{step.t}</h3>
                <p className="mt-2 max-w-sm text-[16px] leading-relaxed text-ink-2">{step.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="dove" className="scroll-mt-4 py-16 md:py-24">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 md:px-8 lg:grid-cols-2">
          <div>
            <h2 className="font-narrow text-[clamp(2.6rem,5.4vw,4.6rem)] font-black uppercase leading-[0.9] text-eu-deep">Dove siamo</h2>
            {s.address && <p className="mt-6 text-[22px] font-bold leading-snug">{s.address}</p>}
            {s.hours && <p className="mt-2 text-[17px] text-ink-2">{s.hours}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch lg:justify-end">
            {s.phone && (
              <a href={`tel:${s.phone}`} className="flex h-16 items-center gap-4 rounded-2xl bg-red px-6 text-[18px] font-bold text-white hover:bg-red-deep">
                <Phone className="size-5" /> Chiama <span className="ml-auto font-normal tabular text-white/70">{s.phone}</span>
              </a>
            )}
            {s.whatsapp && (
              <a href={waHref(s.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex h-16 items-center gap-4 rounded-2xl bg-paper px-6 text-[18px] font-bold ring-1 ring-line hover:ring-ink">
                <MessageCircle className="size-5" /> Scrivici su WhatsApp
              </a>
            )}
            {s.mapsUrl && (
              <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex h-16 items-center gap-4 rounded-2xl bg-paper px-6 text-[18px] font-bold ring-1 ring-line hover:ring-ink">
                <MapPin className="size-5" /> Apri in Google Maps
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

