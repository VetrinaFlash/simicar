import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { VehicleArt } from "@/components/vehicle-art";
import type { SaleVehicle } from "@/lib/public";
import { mediaUrl } from "@/lib/vehicles";

export const CONDITION_LABEL: Record<string, string> = { usato: "Usato", km0: "Km 0", nuovo: "Nuovo" };

export function saleFacts(v: Pick<SaleVehicle, "year" | "registrationDate" | "mileageKm" | "saleCondition">) {
  const facts: string[] = [];
  if (v.saleCondition) facts.push(CONDITION_LABEL[v.saleCondition] ?? v.saleCondition);
  const year = v.registrationDate?.slice(0, 4) ?? (v.year ? String(v.year) : null);
  if (year) facts.push(year);
  if (v.mileageKm != null) facts.push(`${v.mileageKm.toLocaleString("it-IT")} km`);
  return facts;
}

export function SaleSection({ vehicles }: { vehicles: SaleVehicle[] }) {
  if (vehicles.length === 0) return null;
  return (
    <section id="vendita" className="scroll-mt-16 border-t border-line bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 inline-flex h-8 items-center rounded-full bg-red px-3.5 text-[14px] font-bold text-white">Dalla nostra flotta</p>
            <h2 className="font-narrow text-[clamp(2.6rem,5.4vw,4.6rem)] font-black uppercase leading-[0.9] text-eu-deep">In vendita</h2>
          </div>
          <p className="max-w-md text-[17px] text-ink-2">Mezzi che conosciamo bene: tagliandati da noi, con la loro storia di manutenzione.</p>
        </div>
        <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
          {vehicles.map((v) => {
            const cover = v.photos[0];
            return (
              <li key={v.id}>
                <Link href={`/vendita/${v.slug}`} className="group grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-4 focus-visible:outline-offset-4 sm:block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-concrete-2 sm:rounded-[20px]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl(cover.key)}
                        alt={v.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <VehicleArt type={v.type} className="absolute inset-0 m-auto w-3/5 text-ink-3" />
                    )}
                    {/* Il prezzo come un cartellino da concessionaria */}
                    <span className="absolute left-2 top-2 rounded-lg bg-red px-2 py-1 text-white shadow-lg sm:left-4 sm:top-4 sm:rounded-xl sm:px-3.5 sm:py-2">
                      <span className="font-narrow block text-[17px] sm:text-[26px] font-black leading-none tabular">
                        {v.salePriceEur != null ? `€${v.salePriceEur.toLocaleString("it-IT")}` : "Su richiesta"}
                      </span>
                    </span>
                    <span className="absolute bottom-4 right-4 hidden translate-y-2 sm:inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-[14px] font-bold text-eu-deep opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      Scopri di più <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                  <div className="sm:mt-4">
                    <p className="text-[13px] font-bold text-red">{v.type === "furgone" ? "Furgone" : "Auto"}</p>
                    <h3 className="truncate text-[19px] sm:text-[22px] font-extrabold leading-tight tracking-tight">
                      {v.brand} <span className="font-semibold">{v.model}</span>
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[14px] text-ink-2 sm:mt-1.5 sm:text-[15px]">{[...saleFacts(v), ...v.specs.slice(-1)].join(" · ")}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
