"use client";

import clsx from "clsx";
import {
  Bell,
  CalendarRange,
  CarFront,
  ClipboardList,
  Inbox,
  LogOut,
  Menu,
  Settings,
  Tag,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/admin/actions/auth";
import type { AdminUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Oggi", icon: Sun, exact: true },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarRange },
  { href: "/admin/richieste", label: "Richieste", icon: Inbox, badge: true },
  { href: "/admin/prenotazioni", label: "Prenotazioni", icon: ClipboardList },
  { href: "/admin/flotta", label: "Flotta", icon: CarFront },
  { href: "/admin/clienti", label: "Clienti", icon: Users },
  { href: "/admin/vendite", label: "Vendite", icon: Tag, inquiries: true },
  { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
];
const MOBILE_MAIN = ["/admin", "/admin/calendario", "/admin/richieste", "/admin/flotta"];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  user,
  businessName,
  pending,
  unread,
  inquiries = 0,
  children,
}: {
  user: AdminUser;
  businessName: string;
  pending: number;
  unread: number;
  inquiries?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/admin/" }).catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-ink px-3 py-5 text-white md:flex">
        <Link href="/admin" className="mx-2 mb-7 block overflow-hidden rounded-xl bg-eu ring-2 ring-inset ring-white/90">
          <span className="block bg-red px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">Gestione</span>
          <span className="font-narrow block truncate px-4 pb-2.5 pt-1.5 text-[24px] font-black uppercase leading-none">{businessName}</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  active ? "text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                  />
                )}
                <n.icon className="relative size-[19px]" strokeWidth={2} />
                <span className="relative">{n.label}</span>
                {n.badge && pending > 0 && (
                  <span className="relative ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-signal px-1.5 text-xs font-bold text-ink">
                    {pending}
                  </span>
                )}
                {"inquiries" in n && inquiries > 0 && (
                  <span className="relative ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-red px-1.5 text-xs font-bold text-white">
                    {inquiries}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-white/10 px-3 pt-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-white/50">{user.email}</p>
          <form action={logoutAction}>
            <button className="mt-3 flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <LogOut className="size-4" /> Esci
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Barra superiore */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-concrete/85 px-4 backdrop-blur-xl md:px-8">
          <Link href="/admin" className="font-narrow truncate text-[22px] font-black uppercase text-eu-deep md:invisible">
            {businessName}
          </Link>
          <Link
            href="/admin/notifiche"
            aria-label={unread ? `Notifiche, ${unread} da leggere` : "Notifiche"}
            className="relative grid size-10 place-items-center rounded-full text-ink-2 hover:bg-concrete-2"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-stop px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 md:px-8 md:pb-16">{children}</main>
      </div>

      {/* Tab bar mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map((n) => {
            const active = isActive(pathname, n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-eu" : "text-ink-3")}
              >
                <span className="relative">
                  <n.icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                  {n.badge && pending > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-signal px-1 text-[10px] font-bold text-ink">
                      {pending}
                    </span>
                  )}
                </span>
                {n.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-3"
          >
            <span className="relative">
              <Menu className="size-[22px]" />
              {inquiries > 0 && <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-red" />}
            </span>
            Altro
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Altre sezioni"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-paper p-4 md:hidden"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            >
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="font-bold">{user.name}</p>
                <button onClick={() => setMoreOpen(false)} aria-label="Chiudi" className="grid size-10 place-items-center rounded-full hover:bg-concrete">
                  <X className="size-5" />
                </button>
              </div>
              {NAV.filter((n) => !MOBILE_MAIN.includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} className="flex h-14 items-center gap-3 rounded-xl px-3 text-[16px] font-medium hover:bg-concrete">
                  <n.icon className="size-5 text-ink-2" /> {n.label}
                  {"inquiries" in n && inquiries > 0 && (
                    <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-red px-1.5 text-xs font-bold text-white">{inquiries}</span>
                  )}
                </Link>
              ))}
              <form action={logoutAction}>
                <button className="flex h-14 w-full items-center gap-3 rounded-xl px-3 text-[16px] font-medium text-stop hover:bg-stop-soft">
                  <LogOut className="size-5" /> Esci
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
