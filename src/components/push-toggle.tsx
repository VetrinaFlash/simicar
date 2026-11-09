"use client";

import { BellOff, BellRing, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { testPushAction, type TestPushResult } from "@/app/admin/actions/settings";
import { Button } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "nokey" | "error";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/**
 * Registrazione del service worker del pannello.
 * Lo scope è "/admin" (senza barra finale) così copre anche la pagina /admin.
 * Le vecchie registrazioni con scope "/admin/" vengono rimosse.
 */
export async function adminServiceWorker(): Promise<ServiceWorkerRegistration> {
  for (const r of await navigator.serviceWorker.getRegistrations()) {
    if (new URL(r.scope).pathname === "/admin/") await r.unregister();
  }
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
  if (!reg.active) {
    const w = reg.installing ?? reg.waiting;
    if (w)
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 8000);
        w.addEventListener("statechange", () => {
          if (w.state === "activated") {
            clearTimeout(t);
            resolve();
          }
        });
      });
  }
  return reg;
}

async function serverKey(): Promise<string | null> {
  const r = await fetch("/api/admin/push", { cache: "no-store" });
  if (!r.ok) return null;
  return ((await r.json()) as { publicKey: string | null }).publicKey;
}

async function saveEndpoint(endpoint: string) {
  const r = await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint }) });
  return r.ok;
}

/** Attiva/disattiva le notifiche push su questo dispositivo. */
export function PushToggle({ variant = "full" }: { variant?: "full" | "banner" }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestPushResult | null>(null);

  useEffect(() => {
    (async () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(isIOS && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await adminServiceWorker();
      let sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // Se le chiavi del server sono cambiate, rifà l'attivazione da solo; poi la risalva sul server
        const key = await serverKey();
        if (key && !sameKey(sub.options.applicationServerKey, b64ToUint8(key))) {
          await sub.unsubscribe();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
        }
        await saveEndpoint(sub.endpoint);
      }
      setState(sub ? "on" : "off");
    })().catch(() => setState("error"));
  }, []);

  async function enable() {
    setBusy(true);
    setTest(null);
    try {
      const key = await serverKey();
      if (!key) return setState("nokey");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await adminServiceWorker();
      const old = await reg.pushManager.getSubscription();
      if (old) await old.unsubscribe();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
      setState((await saveEndpoint(sub.endpoint)) ? "on" : "error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setTest(null);
    try {
      const reg = await adminServiceWorker();
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

  async function sendTest() {
    setBusy(true);
    try {
      setTest(await testPushAction());
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
            {busy ? "Attivazione…" : "Attiva notifiche"}
          </Button>
        )}
      </div>
    );
  }

  const text: Record<State, string> = {
    loading: "Controllo…",
    unsupported: "Questo browser non supporta le notifiche push.",
    "ios-install": "Su iPhone aggiungi prima il pannello alla schermata Home (Condividi → Aggiungi alla schermata Home), poi aprilo da lì.",
    denied: "Le notifiche sono bloccate per questo sito: riattivale dalle impostazioni del browser (lucchetto accanto all'indirizzo → Notifiche → Consenti).",
    off: "Le notifiche sono spente su questo dispositivo.",
    on: "Le notifiche sono attive su questo dispositivo.",
    nokey: "Le chiavi per le notifiche non sono ancora configurate sul server.",
    error: "Attivazione non riuscita. Ricarica la pagina e riprova.",
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[15px]">
          {state === "on" ? <BellRing className="size-5 text-go" /> : <BellOff className="size-5 text-ink-3" />}
          {text[state]}
        </p>
        <div className="flex gap-2">
          {(state === "off" || state === "error") && (
            <Button onClick={enable} disabled={busy}>
              {busy ? "Attivazione…" : "Attiva su questo dispositivo"}
            </Button>
          )}
          {state === "on" && (
            <>
              <Button onClick={sendTest} disabled={busy}>
                {busy ? "Invio…" : "Invia notifica di prova"}
              </Button>
              <Button variant="secondary" onClick={disable} disabled={busy}>
                Disattiva
              </Button>
            </>
          )}
        </div>
      </div>
      {test && (
        <ul className="space-y-1.5 rounded-xl bg-concrete p-3 text-sm">
          {test.lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2">
              {l.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-go" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-stop" />}
              <span>{l.text}</span>
            </li>
          ))}
          {test.lines.some((l) => l.ok) && (
            <li className="pt-1 text-ink-3">Se il servizio risulta «inviata» ma la notifica non compare, controlla che il telefono non abbia il risparmio energetico o le notifiche di Chrome disattivate.</li>
          )}
        </ul>
      )}
    </div>
  );
}
