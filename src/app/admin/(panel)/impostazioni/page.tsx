import { like } from "drizzle-orm";
import { removeDemoDataAction } from "@/app/admin/actions/settings";
import { ConfirmButton } from "@/components/confirm-button";
import { PushToggle } from "@/components/push-toggle";
import { getDb, schema } from "@/lib/db";
import { PageHeader, Panel, PanelHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { cargosConfigured } from "@/lib/cargos";
import { getEnv } from "@/lib/env";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { PasswordForm, SettingsForm } from "./forms";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const s = await getSettings();
  const db = await getDb();
  const env = await getEnv();
  const cargosOn = await cargosConfigured();
  const services = [
    { label: "Email ai clienti (Resend)", on: !!env.RESEND_API_KEY, off: "Non attive: richieste e conferme funzionano, ma i clienti non ricevono email." },
    { label: "Notifiche push", on: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY), off: "Chiavi VAPID mancanti." },
    { label: "Invio automatico CaRGOS", on: cargosOn, off: "Usa la scheda PDF finché non inserisci le credenziali." },
    { label: "Protezione anti-spam Turnstile", on: !!env.TURNSTILE_SECRET_KEY, off: "Facoltativa: restano attivi i filtri anti-bot di base." },
  ];
  const hasDemo = !!(await db.query.vehicles.findFirst({ where: like(schema.vehicles.id, "de000000-%"), columns: { id: true } }));
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Impostazioni" />
      <Panel>
        <PanelHeader title="Servizi collegati" />
        <ul className="grid gap-px overflow-hidden rounded-b-2xl bg-line/60 sm:grid-cols-2">
          {services.map((x) => (
            <li key={x.label} className="flex gap-3 bg-paper p-4">
              {x.on ? <CheckCircle2 className="size-5 shrink-0 text-go" /> : <CircleDashed className="size-5 shrink-0 text-ink-3" />}
              <div>
                <p className="text-[15px] font-semibold">{x.label}</p>
                <p className="text-sm text-ink-3">{x.on ? "Attivo" : x.off}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <PanelHeader title="Notifiche push" sub="Attivale su ogni telefono o computer da cui gestisci il noleggio." />
        <div className="px-5 pb-5">
          <PushToggle />
        </div>
      </Panel>
      {hasDemo && (
        <Panel className="p-5 ring-2 ring-signal">
          <p className="text-[17px] font-bold">Dati dimostrativi presenti</p>
          <p className="mt-1 text-sm text-ink-3">Mezzi, clienti e prenotazioni di esempio caricati per la presentazione. Rimuovili prima di iniziare a lavorare davvero.</p>
          <ConfirmButton action={removeDemoDataAction} message="Eliminare tutti i mezzi, clienti e prenotazioni di esempio?" variant="danger" className="mt-4">
            Rimuovi dati demo
          </ConfirmButton>
        </Panel>
      )}
      <SettingsForm settings={s} cargosConfigured={cargosOn} />
      <Panel>
        <PanelHeader title="Password" sub={`Account: ${me.email}`} />
        <div className="px-5 pb-5">
          <PasswordForm />
        </div>
      </Panel>
    </div>
  );
}
