# Lavoro rimanente (prompt per continuare)

Contesto: gestionale per il noleggio auto e furgoni "Manhattan" (presto "Similar"), dominio noleggiomanhattan.it.
Stack: Next.js 16 + OpenNext su Cloudflare Workers, D1 (Drizzle), R2, Resend, Web Push VAPID. Leggi `README.md`.
Stile: palette del logo (rosso `--color-red`, blu `--color-eu`, navy `--color-eu-deep`), titoli Archivo condensato (`font-narrow font-black uppercase`), skyline di Manhattan animata nella hero.
Lingua dell'interfaccia: italiano. Non usare mai `any` e non indebolire i controlli di sicurezza (requireAdmin in ogni action, isSameOrigin nelle API).

## Fatto
- Sito pubblico completo: hero, flotta filtrabile, scheda veicolo con calendario disponibilità, richiesta, privacy.
- Pannello completo: Oggi, Calendario timeline con drag, Richieste, Prenotazioni, Flotta con foto, Clienti, Impostazioni, Notifiche.
- Email Resend, push, cron giornaliero, dati demo, attivazione primo accesso.
- PDF contratto e scheda CaRGOS (`/api/admin/bookings/[id]/pdf?tipo=contratto|cargos`, pdf-lib), spunta "inviato a CaRGOS", avviso in dashboard.

## Da fare (solo quando arrivano i dati)
1. Dati reali dal pannello Impostazioni: indirizzo, telefono, WhatsApp, email, P.IVA, orari, codice agenzia CaRGOS e comune della sede.
2. Foto reali dei mezzi dal pannello Flotta, poi Impostazioni → "Rimuovi dati demo".
3. Credenziali CaRGOS nei segreti del Worker (`CARGOS_USERNAME`, `CARGOS_PASSWORD`, `CARGOS_API_KEY`) e primo invio di prova.
4. Resend: verifica del dominio noleggiomanhattan.it e segreto `RESEND_API_KEY`.
5. Cambio nome da Manhattan a Similar: logo in `public/brand/`, nome in Impostazioni, `RESEND_FROM` in `wrangler.jsonc`.

## Predisposto ma non attivo
- Multisede: tabella `locations` e campi `vehicles.location_id`, `bookings.pickup_location_id/return_location_id`. Manca l'interfaccia (gestione sedi, scelta della sede nel sito e nel pannello).

## Proposte scartate dal cliente (non implementare senza nuova richiesta)
Firma su tablet, foto dei danni, gestione multe, statistiche avanzate.
