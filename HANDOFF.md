# Lavoro rimanente (prompt per continuare)

Contesto: gestionale per il noleggio auto e furgoni "Manhattan" (presto "Similar"), dominio simicar.it.
Stack: Next.js 16 + OpenNext su Cloudflare Workers, D1 (Drizzle), R2, Resend, Web Push VAPID. Leggi `README.md`.
Stile: palette del logo (rosso `--color-red`, blu `--color-eu`, navy `--color-eu-deep`), titoli Archivo condensato (`font-narrow font-black uppercase`), skyline di Manhattan animata nella hero.
Lingua dell'interfaccia: italiano. Non usare mai `any` e non indebolire i controlli di sicurezza (requireAdmin in ogni action, isSameOrigin nelle API).

## Fatto
- Sito pubblico completo: hero, flotta filtrabile, scheda veicolo con calendario disponibilità, richiesta, privacy.
- Pannello completo: Oggi, Calendario timeline con drag, Richieste, Prenotazioni, Flotta con foto, Clienti, Impostazioni, Notifiche.
- Email Resend, push, cron giornaliero, dati demo, attivazione primo accesso.

## Da fare
1. **PDF contratto + scheda CaRGOS** (richiesto dal cliente): route `GET /api/admin/bookings/[id]/pdf?tipo=contratto|cargos` con `pdf-lib`, solo admin. Pulsanti nel dettaglio prenotazione, più "Segna come inviato a CaRGOS" (campo `bookings.cargos_sent_at` già presente). Sulla dashboard: avviso per le prenotazioni confermate che iniziano entro 48 ore senza invio CaRGOS.
2. **Invio automatico CaRGOS** (gratuito, ma servono username, password e API key rilasciati dalla Questura al noleggiatore): API REST della Polizia. Riferimento non ufficiale per il tracciato: pacchetto PyPI `cargos-api`. Va proposto al cliente prima di implementarlo.
3. **Multisede**: tabella `locations` e campi `vehicles.location_id`, `bookings.pickup_location_id/return_location_id` già nello schema. Mancano la gestione delle sedi in Impostazioni, la sede nel form veicolo, la scelta della sede nel widget pubblico (solo se più di 1 sede attiva), gli orari per sede e la sezione "Dove siamo" con più sedi.
4. Quando arrivano i dati reali: nome, indirizzo, telefono, P.IVA (dal pannello Impostazioni), foto reali dei mezzi, eliminazione dei dati demo.
