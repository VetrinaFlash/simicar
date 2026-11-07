import { asc, desc, eq, ne } from "drizzle-orm";
import { MessageCircle, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { Plate } from "@/components/plate";
import { Badge, Empty, LinkButton, PageHeader, Panel, PanelHeader, eur } from "@/components/ui";
import { VehicleArt } from "@/components/vehicle-art";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { relativeTime } from "@/lib/time";
import { mediaUrl, vehicleName } from "@/lib/vehicles";
import { InquiryActions } from "./inquiry-actions";

export const metadata = { title: "Vendite" };

const CONDITION: Record<string, string> = { usato: "Usato", km0: "Km 0", nuovo: "Nuovo" };

function waLink(phone: string) {
  const d = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${d.length <= 10 ? `39${d}` : d}`;
}

export default async function SalesPage() {
  await requireAdmin();
  const db = await getDb();
  const [vehicles, photos, inquiries] = await Promise.all([
    db.select().from(schema.vehicles).where(ne(schema.vehicles.listing, "rental")).orderBy(asc(schema.vehicles.sortOrder)),
    db.select().from(schema.vehiclePhotos).orderBy(asc(schema.vehiclePhotos.sortOrder)),
    db
      .select({ i: schema.saleInquiries, v: schema.vehicles })
      .from(schema.saleInquiries)
      .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.saleInquiries.vehicleId))
      .where(ne(schema.saleInquiries.status, "closed"))
      .orderBy(asc(schema.saleInquiries.status), desc(schema.saleInquiries.createdAt))
      .limit(100),
  ]);
  const cover = new Map<string, string>();
  for (const p of photos) if (!cover.has(p.vehicleId)) cover.set(p.vehicleId, p.r2Key);
  const onSale = vehicles.filter((v) => !v.soldAt);
  const sold = vehicles.filter((v) => v.soldAt);
  const countFor = (id: string) => inquiries.filter((x) => x.i.vehicleId === id).length;

  return (
    <>
      <PageHeader
        title="Vendite"
        sub={`${onSale.length} ${onSale.length === 1 ? "mezzo" : "mezzi"} in vendita${sold.length ? ` · ${sold.length} venduti` : ""}`}
        action={
          <LinkButton href="/admin/flotta/nuovo">
            <Plus className="size-4" /> Aggiungi mezzo
          </LinkButton>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHeader title="Richieste di informazioni" sub="Dal sito, per i mezzi in vendita." />
          {inquiries.length === 0 ? (
            <Empty title="Nessuna richiesta aperta" text="Quando qualcuno chiede informazioni su un mezzo in vendita, la trovi qui e ti arriva una notifica." />
          ) : (
            <ul className="divide-y divide-line/60 px-5 pb-3">
              {inquiries.map(({ i, v }) => (
                <li key={i.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {i.name} {i.status === "new" && <Badge tone="warn">Nuova</Badge>}
                      </p>
                      <p className="text-sm text-ink-3">
                        {vehicleName(v)} · {relativeTime(i.createdAt)}
                      </p>
                    </div>
                    <InquiryActions id={i.id} status={i.status} />
                  </div>
                  {i.message && <p className="mt-2 whitespace-pre-line rounded-xl bg-concrete p-3 text-[15px]">{i.message}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`tel:${i.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-concrete px-3.5 text-sm font-semibold hover:bg-concrete-2">
                      <Phone className="size-4" /> {i.phone}
                    </a>
                    <a href={waLink(i.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-concrete px-3.5 text-sm font-semibold hover:bg-concrete-2">
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                    {i.email && (
                      <a href={`mailto:${i.email}`} className="inline-flex h-10 items-center rounded-xl bg-concrete px-3.5 text-sm font-semibold hover:bg-concrete-2">
                        {i.email}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="In vendita" />
            {onSale.length === 0 ? (
              <Empty title="Nessun mezzo in vendita" text="Apri un mezzo della flotta e scegli «Vendita» o «Noleggio e vendita»." />
            ) : (
              <ul className="divide-y divide-line/60 px-5 pb-3">
                {onSale.map((v) => {
                  const key = cover.get(v.id);
                  return (
                    <li key={v.id}>
                      <Link href={`/admin/flotta/${v.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <div className="relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-concrete-2">
                          {key ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(key)} alt="" className="size-full object-cover" />
                          ) : (
                            <VehicleArt type={v.type} className="w-3/4 text-ink-3" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{vehicleName(v)}</p>
                          <p className="text-sm text-ink-3">
                            {v.salePriceEur != null ? eur(v.salePriceEur) : "Prezzo su richiesta"}
                            {v.saleCondition ? ` · ${CONDITION[v.saleCondition] ?? v.saleCondition}` : ""}
                            {v.listing === "both" ? " · anche a noleggio" : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Plate value={v.plate} size="sm" />
                          {countFor(v.id) > 0 && <Badge tone="warn">{countFor(v.id)} richieste</Badge>}
                          {!v.isPublic && <Badge>Nascosto</Badge>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          {sold.length > 0 && (
            <Panel>
              <PanelHeader title="Venduti" />
              <ul className="divide-y divide-line/60 px-5 pb-3">
                {sold.map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/flotta/${v.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:opacity-80">
                      <span className="truncate font-semibold">{vehicleName(v)}</span>
                      <Badge tone="ok">Venduto {new Date(v.soldAt!).toLocaleDateString("it-IT")}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

