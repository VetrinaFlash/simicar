"use client";

import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VehicleArt } from "@/components/vehicle-art";
import { cx } from "@/components/ui";
import { mediaUrl } from "@/lib/vehicles";
import type { PublicVehicle } from "@/lib/public";

type Tipo = "" | "auto" | "furgone";

export function Fleet({
  vehicles: all,
  query,
  rangeLabel,
  initialTipo,
}: {
  vehicles: (PublicVehicle & { busy: boolean })[];
  query: string;
  rangeLabel: string | null;
  initialTipo: Tipo;
}) {
  const [tipo, setTipo] = useState<Tipo>(initialTipo);
  useEffect(() => setTipo(initialTipo), [initialTipo]);
  const vehicles = all.filter((v) => !tipo || v.type === tipo);
  const free = vehicles.filter((v) => !v.busy).length;
  const counts = { "": all.length, auto: all.filter((v) => v.type === "auto").length, furgone: all.filter((v) => v.type === "furgone").length };
  const chips: { v: Tipo; label: string }[] = [
    { v: "", label: "Tutti" },
    ...(counts.furgone ? [{ v: "furgone" as Tipo, label: "Furgoni" }] : []),
    ...(counts.auto ? [{ v: "auto" as Tipo, label: "Auto" }] : []),
  ];
  function pick(v: Tipo) {
    setTipo(v);
    const url = new URL(window.location.href);
    if (v) url.searchParams.set("tipo", v);
    else url.searchParams.delete("tipo");
    window.history.replaceState(null, "", url);
  }
  return (
    <section id="flotta" className="scroll-mt-16 py-16 md:py-24">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-narrow text-[clamp(2.6rem,5.4vw,4.6rem)] font-black uppercase leading-[0.9] text-eu-deep">La flotta</h2>
          <p className="text-[17px] text-ink-2" aria-live="polite">
            {rangeLabel
              ? free === 0
                ? `Nessun mezzo libero ${rangeLabel}. Chiamaci: troviamo una soluzione.`
                : `${free} ${free === 1 ? "mezzo libero" : "mezzi liberi"} ${rangeLabel}`
              : `${vehicles.length} ${vehicles.length === 1 ? "mezzo" : "mezzi"}`}
          </p>
        </div>

        {chips.length > 2 && (
          <div role="radiogroup" aria-label="Filtra per tipo" className="mb-10 flex gap-2">
            {chips.map((c) => (
              <button
                key={c.v || "all"}
                type="button"
                role="radio"
                aria-checked={tipo === c.v}
                onClick={() => pick(c.v)}
                className={cx(
                  "relative h-11 rounded-full px-5 text-[15px] font-bold transition-colors",
                  tipo === c.v ? "text-white" : "bg-paper text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3",
                )}
              >
                {tipo === c.v && <motion.span layoutId="fleet-chip" className="absolute inset-0 rounded-full bg-eu-deep" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
                <span className="relative">
                  {c.label} <span className={cx("tabular", tipo === c.v ? "text-white/60" : "text-ink-3")}>{counts[c.v]}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {vehicles.length === 0 ? (
          <p className="rounded-2xl bg-paper p-10 text-center text-ink-2">I mezzi saranno disponibili a breve.</p>
        ) : (
          <motion.ul layout className="grid gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {vehicles.map((v) => {
                const cover = v.photos[0];
                const alt = v.photos[1];
                return (
                  <motion.li
                    key={v.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  >
                    <Link href={`/flotta/${v.slug}${query}`} className="group grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-4 focus-visible:outline-offset-4 sm:block">
                      <div className={cx("relative aspect-[4/3] overflow-hidden rounded-[14px] bg-concrete-2 sm:rounded-[20px]", v.busy && "opacity-55")}>
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(cover.key)}
                            alt={v.name}
                            width={cover.width ?? undefined}
                            height={cover.height ?? undefined}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]"
                          />
                        ) : (
                          <VehicleArt type={v.type} className="absolute inset-0 m-auto w-3/5 text-ink-3" />
                        )}
                        {alt && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(alt.key)}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                          />
                        )}
                        <span className="absolute bottom-4 right-4 hidden translate-y-2 sm:inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 text-[14px] font-bold text-eu-deep opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                          {v.busy ? "Vedi altre date" : "Vedi le date libere"} <ArrowUpRight className="size-4" />
                        </span>
                        {v.busy && (
                          <span className="absolute left-2 top-2 rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-white sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[13px]">Occupato<span className="hidden sm:inline"> in queste date</span></span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-red">{v.type === "furgone" ? "Furgone" : "Auto"}</p>
                          <h3 className="truncate text-[19px] sm:text-[22px] font-extrabold leading-tight tracking-tight">
                            {v.brand} <span className="font-semibold">{v.model}</span>
                          </h3>
                          <p className="mt-1 line-clamp-2 text-[14px] text-ink-2 sm:mt-1.5 sm:text-[15px]">{v.specs.join(" · ")}</p>
                        </div>
                        {v.priceFromEur != null && (
                          <p className="shrink-0 leading-tight sm:text-right">
                            <span className="text-[13px] text-ink-3 sm:block">da </span>
                            <span className="font-narrow text-[24px] sm:text-[30px] font-black leading-none tabular text-eu-deep">€{v.priceFromEur}</span>
                            <span className="text-[13px] text-ink-3 sm:block"> al giorno</span>
                          </p>
                        )}
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </section>
  );
}
