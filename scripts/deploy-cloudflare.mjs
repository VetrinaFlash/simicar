/**
 * Deploy automatico Cloudflare Workers Builds per SimiCar.
 *
 * Build command (Cloudflare):  npm run cf:build
 * Deploy command (Cloudflare): npm run cf:deploy
 *
 * Crea D1/R2 solo quando mancano, applica le migrazioni D1 pendenti,
 * quindi pubblica il Worker Next.js/OpenNext.
 * Non elimina database, bucket o dati esistenti.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DB_NAME = "simicar-db";
const BUCKET_NAME = "simicar-media";
const CONFIG_FILE = "wrangler.jsonc";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, { capture = false } = {}) {
  console.log("> npx " + command.join(" "));
  return execFileSync(npx, ["--no-install", ...command], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, CI: "true" },
  });
}

function wrangler(args, opts) {
  return run(["wrangler", ...args], opts);
}

function databases() {
  const result = JSON.parse(wrangler(["d1", "list", "--json"], { capture: true }));
  const items = Array.isArray(result) ? result : result?.result ?? result?.databases;
  if (!Array.isArray(items)) throw new Error("Risposta D1 list inattesa: verifica credenziali e account Cloudflare");
  return items;
}

function ensureDatabase() {
  let db = databases().find((item) => item.name === DB_NAME);
  if (!db) {
    console.log("Creo D1 " + DB_NAME);
    wrangler(["d1", "create", DB_NAME, "--no-update-config"]);
    db = databases().find((item) => item.name === DB_NAME);
  } else {
    console.log("Riutilizzo D1 " + DB_NAME);
  }
  const id = db?.uuid ?? db?.id ?? db?.database_id;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    throw new Error("ID D1 non disponibile: impossibile applicare le migrazioni in sicurezza");
  }
  return id;
}

function ensureBucket() {
  try {
    wrangler(["r2", "bucket", "info", BUCKET_NAME, "--json"], { capture: true });
    console.log("Riutilizzo R2 " + BUCKET_NAME);
    return;
  } catch (err) {
    const output = String(err?.stderr ?? "") + "\n" + String(err?.stdout ?? "");
    // Non scambiare errori di autenticazione o permessi per risorsa mancante.
    if (!/404|not found|does not exist|doesn't exist|could not find|bucket not found/i.test(output)) {
      throw new Error("Impossibile verificare R2: " + (output.trim() || err.message));
    }
  }
  console.log("Creo R2 " + BUCKET_NAME);
  wrangler(["r2", "bucket", "create", BUCKET_NAME, "--no-update-config"]);
  wrangler(["r2", "bucket", "info", BUCKET_NAME, "--json"], { capture: true });
}

function configureBindings(databaseId) {
  const raw = readFileSync(CONFIG_FILE, "utf8");
  // Il file del progetto contiene solo commenti JSONC su righe dedicate.
  const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
  const db = cfg.d1_databases?.find((item) => item.binding === "DB" && item.database_name === DB_NAME);
  const media = cfg.r2_buckets?.find((item) => item.binding === "MEDIA" && item.bucket_name === BUCKET_NAME);
  if (!db || !media) throw new Error("Binding DB o MEDIA mancante in wrangler.jsonc");

  // L'ID dipende dall'account: aggiorniamo solo la copia temporanea di build.
  db.database_id = databaseId;
  // Rende accessibile il sito su *.workers.dev, anche senza dominio acquistato.
  cfg.workers_dev = true;
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n");
}

try {
  console.log("Cloudflare: controllo D1 e R2");
  const databaseId = ensureDatabase();
  ensureBucket();
  configureBindings(databaseId);
  console.log("Cloudflare: applico solo le migrazioni D1 non ancora eseguite");
  wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
  console.log("Cloudflare: deploy OpenNext");
  run(["opennextjs-cloudflare", "deploy"]);
  console.log("SimiCar: deploy completato. Controlla il link workers.dev nei log.");
} catch (error) {
  console.error("Deploy interrotto: " + error.message);
  console.error("Controlla il token di Workers Builds (permessi D1 e R2) e i log Cloudflare.");
  process.exitCode = 1;
}
