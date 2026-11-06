"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { VehicleArt } from "@/components/vehicle-art";
import { cx } from "@/components/ui";
import { mediaUrl } from "@/lib/vehicles";
import type { PublicVehicle } from "@/lib/public";

export function Fleet({
  vehicles,
  query,
  rangeLabel,
}: {
  vehicles: (PublicVehicle & { busy: boolean })[];
  query: string;
  rangeLabel: string | null;
}) {
  const free = vehicles.filter((v) => !v.busy).length;
  return (
    <section id="flotta" className="scroll-mt-4 py-16 md:py-24">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-narrow text-[clamp(2.6rem,5.4vw,4.6rem)] font-black uppercase leading-[0.9] text-eu-deep">La flotta</h2>
          <p className="text-[17px] text-ink-2" aria-live="polite">
            {rangeLabel
              ? free === 0
                ? `Nessun mezzo libero ${rangeLabel}. Chiamaci: troviamo una soluzione.`
                : `${free} ${free === 1 ? "mezzo libero" : "mezzi liberi"} ${rangeLabel}`
              : `${vehicles.length} ${vehicles.length === 1 ? "mezzo" : "mezzi"}`}
          </p>
        </div>

        {vehicles.length === 0 ? (
          <p className="rounded-2xl bg-paper p-10 text-center text-ink-2">I mezzi saranno disponibili a breve.</p>
        ) : (
          <motion.ul layout className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {vehicles.map((v) => {
                const cover = v.photos[0];
                return (
                  <motion.li
                    key={v.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  >
                    <Link href={`/flotta/${v.slug}${query}`} className="group block focus-visible:outline-offset-4">
                      <div className={cx("relative aspect-[4/3] overflow-hidden rounded-[20px] bg-concrete-2", v.busy && "opacity-55")}>
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
                        {v.busy && (
                          <span className="absolute left-4 top-4 rounded-full bg-ink px-3 py-1.5 text-[13px] font-bold text-white">Occupato in queste date</span>
                        )}
                      </div>
                      <div className="mt-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-red">{v.type === "furgone" ? "Furgone" : "Auto"}</p>
                          <h3 className="truncate text-[22px] font-extrabold leading-tight tracking-tight">
                            {v.brand} <span className="font-semibold">{v.model}</span>
                          </h3>
                          <p className="mt-1.5 text-[15px] text-ink-2">{v.specs.join(" · ")}</p>
                        </div>
                        {v.priceFromEur != null && (
                          <p className="shrink-0 text-right leading-tight">
                            <span className="block text-[13px] text-ink-3">da</span>
                            <span className="font-wide text-[22px] font-extrabold tabular">€{v.priceFromEur}</span>
                            <span className="block text-[13px] text-ink-3">al giorno</span>
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
