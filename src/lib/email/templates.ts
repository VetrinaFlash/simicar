import { fmtDateTime, fmtDuration } from "@/lib/time";
import type { Settings } from "@/lib/settings";

export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BookingMailData = {
  code: string;
  firstName: string;
  vehicleName: string;
  plate?: string;
  startAt: number;
  endAt: number;
  priceEur?: number | null;
  depositEur?: number | null;
  reason?: string | null;
};

function layout(s: Settings, title: string, inner: string) {
  const contacts = [s.phone && `Tel. ${esc(s.phone)}`, s.email && esc(s.email), s.address && esc(s.address)]
    .filter(Boolean)
    .join("<br>");
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;background:#E9EBEE;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#151A22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0a1f5c;padding:22px 28px;color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.01em">${esc(s.businessName)}</td></tr>
<tr><td style="padding:28px">${inner}</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #E1E4E8;font-size:13px;line-height:1.6;color:#5A6270">${contacts}</td></tr>
</table></td></tr></table></body></html>`;
}

function summary(d: BookingMailData) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;color:#5A6270;font-size:14px;width:40%">${k}</td><td style="padding:8px 0;font-size:14px;font-weight:600">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #E1E4E8;border-bottom:1px solid #E1E4E8">
${row("Codice", `<span style="font-family:ui-monospace,Menlo,monospace;background:#F2C230;padding:2px 6px;border-radius:4px">${esc(d.code)}</span>`)}
${row("Veicolo", esc(d.vehicleName))}
${row("Ritiro", esc(fmtDateTime(d.startAt)))}
${row("Riconsegna", esc(fmtDateTime(d.endAt)))}
${row("Durata", esc(fmtDuration(d.startAt, d.endAt)))}
${d.priceEur != null ? row("Prezzo concordato", `€ ${d.priceEur.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`) : ""}
${d.depositEur != null ? row("Cauzione", `€ ${d.depositEur.toLocaleString("it-IT")}`) : ""}
</table>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`;
const h = (t: string) => `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;letter-spacing:-0.01em">${t}</h1>`;

function textSummary(d: BookingMailData) {
  return [
    `Codice: ${d.code}`,
    `Veicolo: ${d.vehicleName}`,
    `Ritiro: ${fmtDateTime(d.startAt)}`,
    `Riconsegna: ${fmtDateTime(d.endAt)}`,
    d.priceEur != null ? `Prezzo concordato: € ${d.priceEur}` : "",
    d.depositEur != null ? `Cauzione: € ${d.depositEur}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function requestReceivedMail(s: Settings, d: BookingMailData) {
  const subject = `Richiesta ricevuta · ${d.vehicleName}`;
  const html = layout(
    s,
    subject,
    h(`Abbiamo ricevuto la tua richiesta, ${esc(d.firstName)}`) +
      p("Controlliamo la disponibilità e ti rispondiamo per email il prima possibile. La prenotazione non è ancora confermata.") +
      summary(d) +
      p("Se devi cambiare qualcosa, rispondi a questa email indicando il codice della richiesta."),
  );
  return { subject, html, text: `Abbiamo ricevuto la tua richiesta. Non è ancora confermata.\n\n${textSummary(d)}` };
}

export function bookingConfirmedMail(s: Settings, d: BookingMailData) {
  const subject = `Prenotazione confermata · ${d.code}`;
  const html = layout(
    s,
    subject,
    h(`Il tuo ${esc(d.vehicleName)} è prenotato`) +
      p(`Ciao ${esc(d.firstName)}, la tua prenotazione è confermata.`) +
      summary(d) +
      p("Al ritiro porta patente e documento d'identità in corso di validità.") +
      (s.address ? p(`Ritiro presso: <strong>${esc(s.address)}</strong>${s.mapsUrl ? ` · <a href="${esc(s.mapsUrl)}" style="color:#0a4a9c">Apri in Maps</a>` : ""}`) : ""),
  );
  return {
    subject,
    html,
    text: `Prenotazione confermata.\n\n${textSummary(d)}\n\nAl ritiro porta patente e documento d'identità.${s.address ? `\nRitiro presso: ${s.address}` : ""}`,
  };
}

export function bookingRejectedMail(s: Settings, d: BookingMailData) {
  const subject = `Richiesta ${d.code}: mezzo non disponibile`;
  const html = layout(
    s,
    subject,
    h(`Purtroppo non riusciamo a confermare`) +
      p(`Ciao ${esc(d.firstName)}, il ${esc(d.vehicleName)} non è disponibile per le date richieste.`) +
      (d.reason ? p(`<em>${esc(d.reason)}</em>`) : "") +
      summary(d) +
      p(`Rispondi a questa email${s.phone ? ` o chiamaci al ${esc(s.phone)}` : ""}: troviamo insieme un'alternativa.`),
  );
  return { subject, html, text: `La richiesta non può essere confermata.${d.reason ? `\n${d.reason}` : ""}\n\n${textSummary(d)}` };
}

export function bookingCancelledMail(s: Settings, d: BookingMailData) {
  const subject = `Prenotazione annullata · ${d.code}`;
  const html = layout(
    s,
    subject,
    h("La prenotazione è stata annullata") +
      p(`Ciao ${esc(d.firstName)}, ti confermiamo l'annullamento della prenotazione.`) +
      summary(d),
  );
  return { subject, html, text: `Prenotazione annullata.\n\n${textSummary(d)}` };
}

export function bookingUpdatedMail(s: Settings, d: BookingMailData) {
  const subject = `Prenotazione aggiornata · ${d.code}`;
  const html = layout(
    s,
    subject,
    h("Abbiamo aggiornato la tua prenotazione") + p(`Ciao ${esc(d.firstName)}, ecco i dettagli aggiornati.`) + summary(d),
  );
  return { subject, html, text: `Prenotazione aggiornata.\n\n${textSummary(d)}` };
}

export function adminNewRequestMail(s: Settings, d: BookingMailData & { customer: string; phone?: string | null; url: string }) {
  const subject = `Nuova richiesta: ${d.vehicleName} · ${fmtDateTime(d.startAt)}`;
  const html = layout(
    s,
    subject,
    h("Nuova richiesta dal sito") +
      p(`<strong>${esc(d.customer)}</strong>${d.phone ? ` · ${esc(d.phone)}` : ""}`) +
      summary(d) +
      `<a href="${esc(d.url)}" style="display:inline-block;background:#0a4a9c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Apri la richiesta</a>`,
  );
  return { subject, html, text: `Nuova richiesta da ${d.customer}\n\n${textSummary(d)}\n\n${d.url}` };
}

export function adminSaleInquiryMail(
  s: Settings,
  d: { vehicleName: string; price: string; name: string; phone: string; email: string | null; message: string | null; url: string },
) {
  const subject = `Richiesta info vendita: ${d.vehicleName}`;
  const html = layout(
    s,
    subject,
    h("Qualcuno è interessato a un mezzo in vendita") +
      p(`<strong>${esc(d.vehicleName)}</strong> · ${esc(d.price)}`) +
      p(`<strong>${esc(d.name)}</strong><br>Tel. ${esc(d.phone)}${d.email ? `<br>${esc(d.email)}` : ""}`) +
      (d.message ? p(`<em>${esc(d.message)}</em>`) : "") +
      `<a href="${esc(d.url)}" style="display:inline-block;background:#0a4a9c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Apri le vendite</a>`,
  );
  return {
    subject,
    html,
    text: `Richiesta informazioni per ${d.vehicleName} (${d.price})\n${d.name} - ${d.phone}${d.email ? ` - ${d.email}` : ""}\n${d.message ?? ""}\n\n${d.url}`,
  };
}
