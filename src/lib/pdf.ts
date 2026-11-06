import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { schema } from "@/lib/db/schema-types";
import type { Settings } from "@/lib/settings";
import { fmtDateTimeFull as fmtDateTime } from "@/lib/time";

const fmtIsoDate = (iso: string) => iso.split("-").reverse().join("/");
import { FUEL_LABELS, vehicleName } from "@/lib/vehicles";

type Booking = typeof schema.bookings.$inferSelect;
type Vehicle = typeof schema.vehicles.$inferSelect;
type Customer = typeof schema.customers.$inferSelect;

const NAVY = rgb(10 / 255, 31 / 255, 92 / 255);
const RED = rgb(225 / 255, 0, 15 / 255);
const INK = rgb(12 / 255, 24 / 255, 56 / 255);
const MUTED = rgb(0.42, 0.46, 0.55);
const LINE = rgb(0.82, 0.85, 0.9);
const WARN_BG = rgb(1, 0.95, 0.82);

/** I font standard PDF usano WinAnsi: sostituisce i caratteri non rappresentabili. */
function clean(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, "");
}

class Writer {
  page: PDFPage;
  y: number;
  readonly M = 48;
  constructor(
    private doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
  ) {
    this.page = doc.addPage([595.28, 841.89]);
    this.y = 841.89 - this.M;
  }
  get W() {
    return 595.28 - this.M * 2;
  }
  ensure(h: number) {
    if (this.y - h < this.M + 20) {
      this.page = this.doc.addPage([595.28, 841.89]);
      this.y = 841.89 - this.M;
    }
  }
  text(t: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; maxW?: number; lh?: number } = {}) {
    const size = o.size ?? 10;
    const f = o.bold ? this.bold : this.font;
    const maxW = o.maxW ?? this.W;
    const lh = o.lh ?? size * 1.35;
    for (const para of clean(t).split("\n")) {
      const words = para.split(" ");
      let line = "";
      const flush = () => {
        this.ensure(lh);
        this.page.drawText(line, { x: this.M + (o.x ?? 0), y: this.y - size, size, font: f, color: o.color ?? INK });
        this.y -= lh;
        line = "";
      };
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) > maxW && line) {
          flush();
          line = w;
        } else line = next;
      }
      flush();
    }
  }
  gap(h = 8) {
    this.y -= h;
  }
  rule(color = LINE) {
    this.page.drawLine({ start: { x: this.M, y: this.y }, end: { x: this.M + this.W, y: this.y }, thickness: 0.8, color });
    this.y -= 8;
  }
  section(title: string) {
    this.ensure(40);
    this.gap(10);
    this.page.drawRectangle({ x: this.M, y: this.y - 18, width: 4, height: 18, color: RED });
    this.page.drawText(clean(title).toUpperCase(), { x: this.M + 12, y: this.y - 14, size: 11, font: this.bold, color: NAVY });
    this.y -= 26;
  }
  /** Griglia di coppie etichetta/valore su 2 colonne. Evidenzia i dati mancanti. */
  fields(rows: [string, string | null | undefined][], cols = 2, highlightMissing = false) {
    const colW = this.W / cols;
    for (let i = 0; i < rows.length; i += cols) {
      this.ensure(34);
      const top = this.y;
      for (let c = 0; c < cols; c++) {
        const r = rows[i + c];
        if (!r) continue;
        const x = this.M + c * colW;
        const missing = !r[1];
        if (missing && highlightMissing) this.page.drawRectangle({ x: x - 2, y: top - 30, width: colW - 8, height: 30, color: WARN_BG });
        this.page.drawText(clean(r[0]), { x, y: top - 9, size: 7.5, font: this.font, color: MUTED });
        const val = missing ? (highlightMissing ? "MANCANTE" : "-") : clean(r[1]);
        let v = val;
        while (this.bold.widthOfTextAtSize(v, 10) > colW - 14 && v.length > 4) v = `${v.slice(0, -4)}...`;
        this.page.drawText(v, { x, y: top - 23, size: 10, font: this.bold, color: missing && highlightMissing ? RED : INK });
      }
      this.y -= 34;
    }
  }
}

async function header(doc: PDFDocument, w: Writer, s: Settings, logoPng: Uint8Array | null, title: string, sub: string) {
  if (logoPng) {
    const img = await doc.embedPng(logoPng);
    const h = 34;
    const iw = (img.width / img.height) * h;
    w.page.drawImage(img, { x: w.M, y: w.y - h, width: iw, height: h });
  }
  const right = [s.businessName, s.vatNumber && `P.IVA ${s.vatNumber}`, s.address, [s.phone, s.email].filter(Boolean).join(" - ")].filter(Boolean) as string[];
  right.forEach((t, i) => {
    const txt = clean(t);
    const size = i === 0 ? 10 : 8;
    const f = i === 0 ? w.bold : w.font;
    w.page.drawText(txt, { x: w.M + w.W - f.widthOfTextAtSize(txt, size), y: w.y - 9 - i * 11, size, font: f, color: i === 0 ? NAVY : MUTED });
  });
  w.y -= 58;
  w.page.drawRectangle({ x: w.M, y: w.y, width: w.W, height: 3, color: NAVY });
  w.y -= 26;
  w.text(title, { size: 20, bold: true, color: NAVY });
  w.text(sub, { size: 9, color: MUTED });
  w.gap(4);
}

const fuel8 = (n: number | null) => (n == null ? null : n === 8 ? "Pieno" : n === 0 ? "Riserva" : `${n}/8`);
const custAddress = (c: Customer | null) => c?.address ?? null;

export async function contractPdf(d: { b: Booking; v: Vehicle; c: Customer | null; s: Settings; logo: Uint8Array | null }) {
  const { b, v, c, s } = d;
  const doc = await PDFDocument.create();
  doc.setTitle(`Contratto di noleggio ${b.code}`);
  doc.setAuthor(s.businessName);
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  await header(doc, w, s, d.logo, `Contratto di noleggio n. ${b.code}`, `Noleggio senza conducente - redatto il ${fmtDateTime(Date.now())}`);

  w.section("Locatario");
  w.fields([
    ["Cognome e nome", c ? `${c.lastName} ${c.firstName}` : null],
    ["Codice fiscale", c?.taxCode],
    ["Nato a", c?.birthPlace],
    ["Data di nascita", c?.birthDate ? fmtIsoDate(c.birthDate) : null],
    ["Residenza", custAddress(c)],
    ["Cittadinanza", c?.citizenship],
    ["Telefono", c?.phone],
    ["Email", c?.email],
    ["Documento", c?.docType && c?.docNumber ? `${c.docType} n. ${c.docNumber}` : null],
    ["Rilasciato da / scadenza", [c?.docIssuedBy, c?.docExpiry && fmtIsoDate(c.docExpiry)].filter(Boolean).join(" - ") || null],
    ["Patente n.", c?.licenseNumber],
    ["Rilasciata da / scadenza", [c?.licenseIssuedBy, c?.licenseExpiry && fmtIsoDate(c.licenseExpiry)].filter(Boolean).join(" - ") || null],
  ]);

  w.section("Veicolo");
  w.fields([
    ["Marca e modello", vehicleName(v)],
    ["Targa", v.plate],
    ["Telaio", v.vin],
    ["Alimentazione", FUEL_LABELS[v.fuel] ?? v.fuel],
    ["Km alla consegna", b.kmOut?.toLocaleString("it-IT")],
    ["Carburante alla consegna", fuel8(b.fuelOut)],
  ]);

  w.section("Periodo e condizioni economiche");
  w.fields([
    ["Ritiro", fmtDateTime(b.startAt)],
    ["Riconsegna prevista", fmtDateTime(b.endAt)],
    ["Luogo di ritiro e riconsegna", s.address || s.businessName],
    ["Patente richiesta", v.licenseRequired],
    ["Corrispettivo concordato", b.priceEur != null ? `EUR ${b.priceEur.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : null],
    ["Deposito cauzionale", b.depositEur != null ? `EUR ${b.depositEur.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : null],
  ]);

  w.section("Stato del veicolo alla consegna");
  w.text("Danni o segni presenti (indicare posizione):", { size: 9, color: MUTED });
  for (let i = 0; i < 3; i++) {
    w.gap(16);
    w.rule();
  }

  w.section("Condizioni generali");
  const clauses = [
    "Il veicolo è consegnato in buono stato, pulito e con il livello di carburante indicato; va riconsegnato nelle stesse condizioni, alla data, ora e luogo concordati. Il carburante mancante e la pulizia straordinaria sono addebitati.",
    "Il veicolo può essere guidato solo dal locatario o dai conducenti indicati nel contratto, in possesso di patente valida. È vietato il subnoleggio, il trasporto a pagamento di persone o cose, l'uso in gare e la guida in stato di alterazione.",
    "Il locatario risponde delle contravvenzioni, dei pedaggi e delle spese relative al periodo di noleggio. Il locatore comunicherà all'autorità i dati del conducente per la rinotifica dei verbali.",
    "In caso di incidente, furto o guasto il locatario deve avvisare subito il locatore e compilare la constatazione amichevole. Restano a carico del locatario i danni non coperti dall'assicurazione e la franchigia prevista.",
    "Il deposito cauzionale è restituito alla riconsegna, dedotti eventuali addebiti. Il ritardo nella riconsegna comporta l'addebito di una giornata aggiuntiva.",
    "I dati del locatario sono trattati per l'esecuzione del contratto e comunicati alla Polizia di Stato tramite il sistema CaRGOS, come previsto dall'art. 17 del D.L. 113/2018.",
  ];
  clauses.forEach((t, i) => w.text(`${i + 1}. ${t}`, { size: 8.5, lh: 11.5 }));
  w.gap(2);
  w.text("Modello di condizioni generali: va verificato e adattato dal titolare con il proprio consulente.", { size: 7.5, color: MUTED });

  w.ensure(130);
  w.gap(18);
  const sig = (label: string, x: number) => {
    w.page.drawText(clean(label), { x, y: w.y, size: 8.5, font: w.font, color: MUTED });
    w.page.drawLine({ start: { x, y: w.y - 36 }, end: { x: x + 210, y: w.y - 36 }, thickness: 0.8, color: INK });
  };
  sig("Firma del locatore", w.M);
  sig("Firma del locatario", w.M + w.W - 210);
  w.y -= 60;
  w.text(
    "Ai sensi degli artt. 1341 e 1342 c.c. il locatario dichiara di approvare specificamente le clausole 2, 3, 4 e 5 delle condizioni generali.",
    { size: 8.5 },
  );
  w.gap(14);
  sig("Firma del locatario", w.M + w.W - 210);
  w.y -= 46;
  return doc.save();
}

export async function cargosPdf(d: { b: Booking; v: Vehicle; c: Customer | null; s: Settings; logo: Uint8Array | null }) {
  const { b, v, c, s } = d;
  const doc = await PDFDocument.create();
  doc.setTitle(`Dati CaRGOS ${b.code}`);
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  await header(doc, w, s, d.logo, "Scheda dati CaRGOS", `Contratto ${b.code} - dati da comunicare alla Polizia di Stato (art. 17 D.L. 113/2018)`);
  w.text(
    "Copia questi dati sul portale cargos.poliziadistato.it contestualmente al contratto e comunque prima della consegna del veicolo. I campi evidenziati mancano: completali nella scheda cliente prima dell'invio.",
    { size: 9, color: MUTED },
  );

  w.section("Contratto");
  w.fields(
    [
      ["Identificativo contratto", b.code],
      ["Data contratto", fmtDateTime(b.decidedAt ?? b.createdAt)],
      ["Inizio noleggio (data e ora)", fmtDateTime(b.startAt)],
      ["Fine noleggio prevista", fmtDateTime(b.endAt)],
      ["Luogo di consegna", s.address],
      ["Luogo di riconsegna", s.address],
    ],
    2,
    true,
  );
  w.section("Veicolo");
  w.fields(
    [
      ["Tipo", v.type === "furgone" ? "Autocarro / veicolo commerciale" : "Autovettura"],
      ["Marca", v.brand],
      ["Modello", [v.model, v.version].filter(Boolean).join(" ")],
      ["Targa", v.plate],
      ["Numero di telaio", v.vin],
      ["Colore", v.color],
    ],
    2,
    true,
  );
  w.section("Conducente");
  w.fields(
    [
      ["Cognome", c?.lastName],
      ["Nome", c?.firstName],
      ["Data di nascita", c?.birthDate ? fmtIsoDate(c.birthDate) : null],
      ["Luogo di nascita", c?.birthPlace],
      ["Cittadinanza", c?.citizenship],
      ["Codice fiscale", c?.taxCode],
      ["Residenza", c?.address],
      ["Tipo documento", c?.docType],
      ["Numero documento", c?.docNumber],
      ["Rilasciato da", c?.docIssuedBy],
      ["Numero patente", c?.licenseNumber],
      ["Patente rilasciata da", c?.licenseIssuedBy],
      ["Scadenza patente", c?.licenseExpiry ? fmtIsoDate(c.licenseExpiry) : null],
      ["Telefono", c?.phone],
    ],
    2,
    true,
  );
  w.section("Agenzia");
  w.fields(
    [
      ["Denominazione", s.businessName],
      ["Partita IVA", s.vatNumber],
      ["Indirizzo", s.address],
      ["Telefono", s.phone],
    ],
    2,
    true,
  );
  w.gap(10);
  w.text(
    b.cargosSentAt ? `Segnato come inviato a CaRGOS il ${fmtDateTime(b.cargosSentAt)}.` : "Non ancora segnato come inviato: dopo l'invio, segnalo nel pannello.",
    { size: 9, bold: true, color: b.cargosSentAt ? NAVY : RED },
  );
  return doc.save();
}
