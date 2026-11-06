import { like } from "drizzle-orm";
import { removeDemoDataAction } from "@/app/admin/actions/settings";
import { ConfirmButton } from "@/components/confirm-button";
import { PushToggle } from "@/components/push-toggle";
import { getDb, schema } from "@/lib/db";
import { PageHeader, Panel, PanelHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PasswordForm, SettingsForm } from "./forms";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const s = await getSettings();
  const db = await getDb();
  const hasDemo = !!(await db.query.vehicles.findFirst({ where: like(schema.vehicles.id, "de000000-%"), columns: { id: true } }));
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Impostazioni" />
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
      <SettingsForm settings={s} />
      <Panel>
        <PanelHeader title="Password" sub={`Account: ${me.email}`} />
        <div className="px-5 pb-5">
          <PasswordForm />
        </div>
      </Panel>
    </div>
  );
}
