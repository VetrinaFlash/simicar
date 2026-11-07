"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import Script from "next/script";
import { useActionState, useEffect, useRef, useState } from "react";
import { saleInquiryAction, type InquiryState } from "@/app/(site)/actions";
import { cx } from "@/components/ui";

const inputCls =
  "block h-13 w-full rounded-xl bg-paper px-4 text-[16px] ring-1 ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-eu";

export function InquiryForm({ vehicleId, vehicleName, turnstileSiteKey }: { vehicleId: string; vehicleName: string; turnstileSiteKey?: string }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(saleInquiryAction, {});
  const [token, setToken] = useState("");
  const el = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const tryRender = () => {
      if (window.turnstile && el.current && !widget.current) {
        widget.current = window.turnstile.render(el.current, {
          sitekey: turnstileSiteKey,
          language: "it",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(""),
        });
      }
    };
    tryRender();
    const i = setInterval(tryRender, 300);
    return () => clearInterval(i);
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (state.error && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      setToken("");
    }
  }, [state]);

  if (state.ok)
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="road-sign p-8" role="status">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
          className="grid size-14 place-items-center rounded-full bg-red text-white"
        >
          <Check className="size-8" strokeWidth={3} />
        </motion.div>
        <h3 className="font-narrow mt-5 text-[36px] font-black uppercase leading-none">Richiesta inviata</h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/85">Ti ricontattiamo al più presto per darti tutte le informazioni e fissare una prova del mezzo.</p>
      </motion.div>
    );

  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="rounded-[20px] bg-paper p-5 ring-1 ring-line md:p-6">
      {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" />}
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="turnstileToken" value={token} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sito web <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <h2 className="text-[19px] font-extrabold tracking-tight">Ti interessa?</h2>
      <p className="mt-1 text-[15px] text-ink-2">Lasciaci un recapito: ti richiamiamo per tutte le informazioni e per vederlo dal vivo.</p>
      <div className="mt-5 space-y-3">
        {[
          { n: "name", l: "Nome e cognome", ac: "name", t: "text" },
          { n: "phone", l: "Telefono", ac: "tel", t: "tel", im: "tel" },
          { n: "email", l: "Email (facoltativa)", ac: "email", t: "email", im: "email", optional: true },
        ].map((f) => (
          <label key={f.n} className="block">
            <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">{f.l}</span>
            <input
              name={f.n}
              type={f.t}
              inputMode={f.im as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
              autoComplete={f.ac}
              required={!f.optional}
              maxLength={f.n === "email" ? 160 : 80}
              aria-invalid={!!fe[f.n]}
              className={cx(inputCls, fe[f.n] && "ring-2 ring-stop")}
            />
            {fe[f.n] && <span className="mt-1 block text-[13px] font-medium text-stop">{fe[f.n]}</span>}
          </label>
        ))}
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">Messaggio (facoltativo)</span>
          <textarea name="message" rows={3} maxLength={1000} defaultValue={`Buongiorno, vorrei informazioni sul ${vehicleName}.`} className={cx(inputCls, "h-auto py-3")} />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="privacy" required className="mt-0.5 size-5 shrink-0 accent-eu" />
          <span>
            Ho letto l&apos;
            <a href="/privacy" target="_blank" className="font-semibold text-eu underline-offset-2 hover:underline">informativa privacy</a> e acconsento a essere ricontattato.
          </span>
        </label>
      </div>
      {turnstileSiteKey && <div ref={el} className="mt-4 min-h-[65px]" />}
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-stop-soft px-4 py-3 text-[15px] font-semibold text-stop">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || (!!turnstileSiteKey && !token)}
        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-red px-6 text-[18px] font-extrabold text-white transition-[transform,background] hover:bg-red-deep active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Invio in corso…" : "Richiedi informazioni"}
      </button>
    </form>
  );
}
