import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const [s, env] = await Promise.all([getSettings(), getEnv()]);
  const title = `${s.businessName} · Noleggio auto e furgoni${s.city ? ` a ${s.city}` : ""}`;
  return {
    metadataBase: new URL(env.PUBLIC_SITE_URL),
    title: { default: title, template: `%s · ${s.businessName}` },
    description: s.heroText,
    openGraph: { title, description: s.heroText, type: "website", locale: "it_IT" },
    alternates: { canonical: "/" },
  };
}

function waHref(n: string) {
  const d = n.replace(/[^\d]/g, "");
  return `https://wa.me/${d.length <= 10 ? `39${d}` : d}`;
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const year = new Date().getFullYear();
  return (
    <>
      <SmoothScroll />
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 md:px-8">
          <Link href="/" aria-label={`${s.businessName}, pagina principale`} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/manhattan-logo-96.webp" alt={s.businessName} width={502} height={96} className="h-9 w-auto md:h-11" />
          </Link>
          <nav className="flex items-center gap-1 text-[15px] font-semibold">
            <Link href="/#flotta" className="hidden rounded-full px-4 py-2 hover:bg-ink/5 sm:block">
              Flotta
            </Link>
            <Link href="/#dove" className="hidden rounded-full px-4 py-2 hover:bg-ink/5 sm:block">
              Dove siamo
            </Link>
            {s.phone && (
              <a href={`tel:${s.phone}`} className="ml-1 inline-flex h-10 items-center gap-2 rounded-full bg-red px-4 text-white hover:bg-red-deep">
                <Phone className="size-4" /> <span className="hidden tabular sm:inline">{s.phone}</span><span className="sm:hidden">Chiama</span>
              </a>
            )}
          </nav>
        </div>
      </header>

      {children}

      <footer className="bg-eu-deep text-white/70">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr] md:px-8">
          <div>
            <p className="font-narrow text-4xl font-black uppercase text-white">{s.businessName}</p>
            <p className="mt-2 max-w-sm text-[15px]">Noleggio auto e furgoni{s.city ? ` a ${s.city}` : ""}.</p>
          </div>
          <div className="space-y-1.5 text-[15px]">
            {s.address && <p>{s.address}</p>}
            {s.hours && <p>{s.hours}</p>}
          </div>
          <div className="space-y-1.5 text-[15px]">
            {s.phone && <a href={`tel:${s.phone}`} className="block hover:text-white">Tel. {s.phone}</a>}
            {s.whatsapp && <a href={waHref(s.whatsapp)} target="_blank" rel="noopener noreferrer" className="block hover:text-white">WhatsApp</a>}
            {s.email && <a href={`mailto:${s.email}`} className="block hover:text-white">{s.email}</a>}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-3 px-5 py-5 text-[13px] md:px-8">
            <p>
              © {year} {s.businessName}
              {s.vatNumber && ` · P.IVA ${s.vatNumber}`} · <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
            </p>
            <p>Sito realizzato da Daniele Zobel</p>
          </div>
        </div>
      </footer>
    </>
  );
}
