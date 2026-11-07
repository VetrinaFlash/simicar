"use client";

import { MessageCircle, Phone } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

export function SiteHeader({ name, phone, whatsapp }: { name: string; phone: string; whatsapp: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 12);
      setShowBar(window.scrollY > 520);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const wa = whatsapp ? `https://wa.me/${(() => { const d = whatsapp.replace(/[^\d]/g, ""); return d.length <= 10 ? `39${d}` : d; })()}` : "";
  const onVehicle = pathname.startsWith("/flotta/");

  return (
    <>
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-40 transition-[background,box-shadow,backdrop-filter] duration-300",
          scrolled ? "bg-paper/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className={cx("mx-auto flex max-w-[1320px] items-center justify-between px-5 transition-[height] duration-300 md:px-8", scrolled ? "h-16" : "h-20")}>
          <Link href="/" aria-label={`${name}, pagina principale`} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/manhattan-logo-96.webp" alt={name} width={502} height={96} className={cx("w-auto transition-[height] duration-300", scrolled ? "h-8 md:h-9" : "h-9 md:h-11")} />
          </Link>
          <nav className="flex items-center gap-1 text-[15px] font-semibold">
            <Link href="/#flotta" className="hidden rounded-full px-4 py-2 hover:bg-ink/5 sm:block">Flotta</Link>
            <Link href="/#come-funziona" className="hidden rounded-full px-4 py-2 hover:bg-ink/5 lg:block">Come funziona</Link>
            <Link href="/#dove" className="hidden rounded-full px-4 py-2 hover:bg-ink/5 sm:block">Dove siamo</Link>
            {phone && (
              <a href={`tel:${phone}`} className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-red px-4 text-white transition-colors hover:bg-red-deep">
                <Phone className="size-4" />
                <span className="hidden tabular sm:inline">{phone}</span>
                <span className="sm:hidden">Chiama</span>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Barra rapida su telefono: compare dopo lo scroll (non nella scheda veicolo, che ha la sua) */}
      <AnimatePresence>
        {showBar && !onVehicle && (phone || wa) && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            className="fixed inset-x-3 bottom-3 z-40 flex gap-2 rounded-2xl bg-eu-deep p-2 shadow-2xl md:hidden"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <Link href="/#flotta" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red text-[15px] font-bold text-white">
              Prenota un mezzo
            </Link>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Scrivici su WhatsApp" className="grid size-12 place-items-center rounded-xl bg-white/10 text-white">
                <MessageCircle className="size-5" />
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} aria-label="Chiamaci" className="grid size-12 place-items-center rounded-xl bg-white/10 text-white">
                <Phone className="size-5" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
