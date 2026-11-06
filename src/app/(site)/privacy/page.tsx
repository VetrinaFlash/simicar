import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Informativa privacy" };

export default async function PrivacyPage() {
  const s = await getSettings();
  const owner = `${s.businessName}${s.vatNumber ? `, P.IVA ${s.vatNumber}` : ""}${s.address ? `, ${s.address}` : ""}`;
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-28 md:px-8">
      <h1 className="font-narrow text-[clamp(2.4rem,5vw,4rem)] font-black uppercase leading-none text-eu-deep">Informativa privacy</h1>
      <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-extrabold [&_h2]:text-ink">
        <p>Informativa ai sensi dell&apos;art. 13 del Regolamento UE 2016/679 (GDPR).</p>
        <h2>Titolare del trattamento</h2>
        <p>{owner}{s.email ? ` · ${s.email}` : ""}.</p>
        <h2>Quali dati trattiamo e perché</h2>
        <p>Nome, cognome, email, telefono e le date della richiesta, per rispondere alla tua richiesta di noleggio e, se confermata, per gestire il contratto. Al ritiro raccogliamo i dati di patente e documento d&apos;identità, che la legge ci obbliga a comunicare alla Polizia di Stato tramite il sistema CaRGOS (art. 17 D.L. 113/2018).</p>
        <h2>Base giuridica</h2>
        <p>Esecuzione di misure precontrattuali e del contratto (art. 6.1.b GDPR) e adempimento di obblighi di legge (art. 6.1.c GDPR).</p>
        <h2>Per quanto tempo</h2>
        <p>Le richieste non confermate sono conservate per 12 mesi. I dati dei contratti per il tempo previsto dalle norme fiscali e civilistiche (10 anni).</p>
        <h2>Chi li riceve</h2>
        <p>Fornitori tecnici che ci aiutano a gestire il servizio (hosting e invio email, con server nell&apos;Unione Europea o con garanzie adeguate) e le autorità quando previsto dalla legge. Non vendiamo né cediamo i tuoi dati a terzi per fini commerciali.</p>
        <h2>I tuoi diritti</h2>
        <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione e portabilità dei tuoi dati, e opporti al trattamento, scrivendo a {s.email || "l'indirizzo email indicato sul sito"}. Puoi anche presentare reclamo al Garante per la protezione dei dati personali.</p>
        <p className="text-[14px] text-ink-3">Questa informativa è un modello: va verificata dal titolare con il proprio consulente prima della pubblicazione definitiva.</p>
      </div>
    </main>
  );
}
