# Manhattan — gestionale noleggio auto e furgoni

Sito pubblico con richieste di prenotazione e pannello di gestione per il noleggio.
Next.js 16 + Cloudflare Workers (OpenNext), database D1, foto su R2, email con Resend, notifiche push native.

## Cosa fa

**Sito pubblico** (`/`)
- Ricerca per tipo di mezzo (auto, furgone) e date, con i mezzi liberi o occupati.
- Scheda veicolo con galleria, caratteristiche e calendario della disponibilità.
- Richiesta di prenotazione senza pagamento: il cliente riceve un'email di riepilogo e il titolare riceve email e notifica push.
- Protezione anti-spam: campo trappola, limiti di frequenza e Cloudflare Turnstile (facoltativo).

**Pannello** (`/admin`, installabile sul telefono come app)
- Oggi: ritiri e riconsegne del giorno, richieste in attesa, stato della flotta, scadenze.
- Calendario a timeline per veicolo: trascina per spostare, clicca uno spazio vuoto per prenotare.
- Richieste: conferma o rifiuta con un tocco. Al cliente parte un'email automatica.
- Prenotazioni: inserimento manuale (telefono, banco), blocchi per officina, consegna e rientro con km e carburante, cambio date o veicolo, annullamento.
- Flotta: schede complete (targa, telaio, caratteristiche, cauzione, scadenze di assicurazione, revisione, bollo e tagliando) e foto scattate dal telefono.
- Clienti: anagrafica, patente, documento (dati per CaRGOS), storico, lista nera, anonimizzazione GDPR.
- Notifiche push e promemoria giornaliero (cron alle 7:00).

## Sicurezza

- Password con PBKDF2-SHA256 (100k iterazioni), sessioni con token casuale (nel database ne è salvato solo l'hash SHA-256), cookie `__Host-` httpOnly, Secure e SameSite.
- Controllo dell'accesso su ogni pagina, action e API lato server, senza affidarsi al middleware.
- Limiti di frequenza su login, richieste e upload. Login a tempo costante (non rivela quali email esistono).
- Prenotazioni senza doppioni: la verifica delle sovrapposizioni avviene nella stessa istruzione SQL della scrittura, quindi in modo atomico.
- CSP restrittiva, HSTS, X-Frame-Options, Permissions-Policy, pannello in `noindex` e `no-store`.
- Upload controllati sui byte effettivi del file (magic bytes); R2 serve solo le foto pubbliche dei veicoli.
- Le push non contengono dati personali: il telefono scarica la notifica dal server con la sessione dell'admin.
- Gli IP non vengono salvati in chiaro (hash con salt). Registro attività (audit log).

## Messa online (Cloudflare)

1. **Collega il repository**: Cloudflare → Workers & Pages → Create → Import a repository → `VetrinaFlash/simicar`, ramo `main`.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npm run cf:deploy`

   Il database D1 (`simicar-db`) e il bucket R2 (`simicar-media`) vengono creati automaticamente al primo deploy. Le tabelle e i dati demo vengono caricati dal comando `wrangler d1 migrations apply`, già incluso in `cf:deploy`.
2. **Segreti**: Worker `simicar` → Settings → Variables and Secrets. Aggiungi, come *Secret*:
   | Nome | Valore |
   |---|---|
   | `ADMIN_PASSWORD` | password fissa del pannello, impostata solo come Cloudflare Secret |
   | `CRON_SECRET` | stringa casuale |
   | `IP_HASH_SALT` | stringa casuale |
   | `RESEND_API_KEY` | da resend.com |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | generati con `npm run vapid:generate` |
   | `TURNSTILE_SECRET_KEY` | facoltativo, da Cloudflare Turnstile |

   Se usi Turnstile, metti la chiave pubblica in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dentro `wrangler.jsonc`.
3. **Dominio**: Worker → Settings → Domains & Routes → aggiungi `simicar.it` e `www.simicar.it` (il dominio deve essere su Cloudflare DNS).
4. **Email**: su Resend aggiungi il dominio `simicar.it` e inserisci i record DNS che ti indica. Il mittente è in `RESEND_FROM` dentro `wrangler.jsonc`.
5. **Primo accesso**: apri `/admin/login` sull’indirizzo `*.workers.dev` assegnato al Worker (o sul dominio personalizzato quando sarà configurato). Username: `M4nh4tt4n`. Password: valore del secret Cloudflare `ADMIN_PASSWORD`. Il primo login crea automaticamente l’account in D1. La pagina `/admin/setup` è disabilitata e la password non viene salvata nel codice. **Usare la stessa stringa per username e password è debole: modificare `ADMIN_PASSWORD` prima dell’uso reale con dati dei clienti.**
6. **Impostazioni**: dal pannello inserisci nome, indirizzo, telefono, WhatsApp, email e orari. Attiva le notifiche su ogni telefono (su iPhone prima "Aggiungi alla schermata Home").
7. **Dati demo**: quando il cliente inizia a lavorare davvero, vai su Impostazioni → *Rimuovi dati demo*.

### Se il provisioning automatico non parte
Crea tu le risorse e aggiungi l'id in `wrangler.jsonc`:
```bash
npx wrangler d1 create simicar-db        # copia database_id dentro d1_databases
npx wrangler r2 bucket create simicar-media
```

## Sviluppo in locale
```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run preview            # build OpenNext + wrangler dev su http://localhost:8787
```
Per l’accesso admin in locale valorizza `ADMIN_PASSWORD` in `.dev.vars` (il file non va caricato su GitHub).

## Struttura
- `src/app/(site)` sito pubblico · `src/app/admin` pannello · `src/app/api` API
- `src/lib/bookings.ts` logica prenotazioni (controllo atomico dei conflitti)
- `src/lib/db/schema.ts` schema D1 (Drizzle) · `migrations/` SQL (`0001_demo_seed.sql` contiene i dati demo)
- `custom-worker.ts` entry del Worker con il cron giornaliero

Nuove migrazioni: modifica lo schema, poi `npx drizzle-kit generate` e rinomina il file con il numero progressivo successivo (es. `0002_...sql`).

---
Sito realizzato da Daniele Zobel
