"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";
import { Skyline } from "./skyline";
import { scrollToId } from "./smooth-scroll";

type Tipo = "" | "auto" | "furgone";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({
  title,
  text,
  city,
  initial,
  today,
  hasVans,
  hasCars,
}: {
  title: string;
  text: string;
  city: string;
  initial: { tipo: Tipo; dal: string; al: string };
  today: string;
  hasVans: boolean;
  hasCars: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [tipo, setTipo] = useState<Tipo>(initial.tipo);
  const [dal, setDal] = useState(initial.dal);
  const [al, setAl] = useState(initial.al);

  // Titolo spezzato in righe "naturali" per la rivelazione a maschera
  const words = title.split(" ");
  const mid = Math.ceil(words.length / 2);
  const lines = words.length > 3 ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")] : [title];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (tipo) p.set("tipo", tipo);
    if (dal) p.set("dal", dal);
    if (al && (!dal || al >= dal)) p.set("al", al);
    router.replace(`/?${p}`, { scroll: false });
    setTimeout(() => scrollToId("flotta"), 60);
  }

  const options: { v: Tipo; label: string }[] = [
    { v: "", label: "Tutti" },
    ...(hasCars ? [{ v: "auto" as Tipo, label: "Auto" }] : []),
    ...(hasVans ? [{ v: "furgone" as Tipo, label: "Furgone" }] : []),
  ];

  return (
    <section className="relative overflow-hidden bg-paper pt-28 md:pt-36">
      <div className="relative z-10 mx-auto grid max-w-[1320px] items-end gap-12 px-5 md:px-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          {city && (
            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-5 flex items-center gap-2.5 text-[17px] font-bold text-red"
            >
              <span className="h-[3px] w-8 bg-red" aria-hidden />
              Noleggio auto e furgoni a {city}
            </motion.p>
          )}
          <h1 className="font-narrow text-[clamp(3.1rem,8.4vw,7.4rem)] font-black uppercase leading-[0.86] tracking-[-0.01em] text-eu-deep">
            {lines.map((l, i) => (
              <span key={i} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className="block"
                  initial={reduce ? false : { y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.09 }}
                >
                  {l}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.45 }}
            className="mt-7 max-w-[34rem] text-[clamp(1.05rem,1.5vw,1.25rem)] leading-relaxed text-ink-2"
          >
            {text}
          </motion.p>
        </div>

        {/* Il cartello stradale: è il modulo di ricerca */}
        <motion.form
          onSubmit={submit}
          action="/"
          method="get"
          initial={reduce ? false : { opacity: 0, rotate: -5, y: -40 }}
          animate={{ opacity: 1, rotate: 0, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14, mass: 1.1, delay: 0.35 }}
          style={{ transformOrigin: "50% -40%" }}
          className="road-sign relative mb-10 overflow-hidden p-7 pt-0 md:mb-14 md:p-9 md:pt-0"
        >
          <div className="-mx-7 mb-6 bg-red px-7 py-3.5 md:-mx-9 md:px-9" style={{ boxShadow: "inset 0 -3px 0 #fff" }}>
            <p className="font-narrow text-[22px] font-black uppercase tracking-wide">Prenota il tuo mezzo</p>
          </div>
          <p className="text-[15px] font-semibold text-white/80">Mi serve</p>
          <div role="radiogroup" aria-label="Tipo di mezzo" className="mt-3 flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o.v || "all"}
                type="button"
                role="radio"
                aria-checked={tipo === o.v}
                onClick={() => setTipo(o.v)}
                className={cx(
                  "relative h-12 rounded-full px-5 text-[17px] font-bold transition-colors",
                  tipo === o.v ? "text-eu-deep" : "text-white ring-2 ring-inset ring-white/40 hover:ring-white",
                )}
              >
                {tipo === o.v && <motion.span layoutId="tipo-pill" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
                <span className="relative">{o.label}</span>
              </button>
            ))}
            <input type="hidden" name="tipo" value={tipo} />
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[15px] font-semibold text-white/80">Ritiro</span>
              <input
                type="date"
                name="dal"
                min={today}
                value={dal}
                onChange={(e) => {
                  setDal(e.target.value);
                  if (al && e.target.value > al) setAl("");
                }}
                className="mt-2 block h-14 w-full rounded-xl bg-white/10 px-3 text-[17px] font-bold text-white ring-2 ring-inset ring-white/25 [color-scheme:dark] focus:outline-none focus:ring-white"
              />
            </label>
            <label className="block">
              <span className="text-[15px] font-semibold text-white/80">Riconsegna</span>
              <input
                type="date"
                name="al"
                min={dal || today}
                value={al}
                onChange={(e) => setAl(e.target.value)}
                className="mt-2 block h-14 w-full rounded-xl bg-white/10 px-3 text-[17px] font-bold text-white ring-2 ring-inset ring-white/25 [color-scheme:dark] focus:outline-none focus:ring-white"
              />
            </label>
          </div>

          <button
            type="submit"
            className="group mt-7 flex h-14 w-full items-center justify-between rounded-xl bg-red px-5 text-[18px] font-extrabold text-white transition-[transform,background] hover:bg-red-deep active:scale-[0.99]"
          >
            Vedi i mezzi liberi
            <ArrowRight className="size-6 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </button>
        </motion.form>
      </div>
      <Skyline className="pointer-events-none relative -mt-6 block h-[130px] w-full md:-mt-10 md:h-[210px]" />
    </section>
  );
}
