"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "nokey";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Attiva/disattiva le notifiche push su questo dispositivo. */
export function PushToggle({ variant = "full" }: { variant?: "full" | "banner" }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(isIOS && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const { publicKey } = (await fetch("/api/admin/push").then((r) => r.json())) as { publicKey: string | null };
      if (!publicKey) return setState("nokey");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      const res = await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      setState(res.ok ? "on" : "off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "banner") {
    if (state !== "off" && state !== "ios-install") return null;
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-eu p-4 text-white sm:flex-row sm:items-center">
        <BellRing className="size-6 shrink-0" />
        <div className="flex-1">
          <p className="font-bold">Ricevi le richieste sul telefono</p>
          <p className="text-sm text-white/80">
            {state === "ios-install"
              ? "Su iPhone: tocca Condividi → «Aggiungi alla schermata Home», poi apri il pannello da lì e attiva le notifiche."
              : "Ti avvisiamo appena arriva una richiesta dal sito, anche con il pannello chiuso."}
          </p>
        </div>
        {state === "off" && (
          <Button variant="secondary" onClick={enable} disabled={busy} className="shrink-0">
            Attiva notifiche
          </Button>
        )}
      </div>
    );
  }

  const text: Record<State, string> = {
    loading: "Controllo…",
    unsupported: "Questo browser non supporta le notifiche push.",
    "ios-install": "Su iPhone aggiungi prima il pannello alla schermata Home (Condividi → Aggiungi alla schermata Home), poi aprilo da lì.",
    denied: "Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser.",
    off: "Le notifiche sono spente su questo dispositivo.",
    on: "Le notifiche sono attive su questo dispositivo.",
    nokey: "Le chiavi per le notifiche non sono ancora configurate sul server.",
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[15px]">
        {state === "on" ? <BellRing className="size-5 text-go" /> : <BellOff className="size-5 text-ink-3" />}
        {text[state]}
      </p>
      {state === "off" && <Button onClick={enable} disabled={busy}>Attiva su questo dispositivo</Button>}
      {state === "on" && <Button variant="secondary" onClick={disable} disabled={busy}>Disattiva</Button>}
    </div>
  );
}
