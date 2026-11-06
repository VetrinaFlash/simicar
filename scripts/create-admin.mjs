// Crea (o aggiorna la password di) un utente del pannello.
// Uso: npm run admin:create -- --email nome@dominio.it --name "Mario Rossi" [--remote]
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const get = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = get("email")?.trim().toLowerCase();
const name = get("name")?.trim() || "Amministratore";
const remote = args.includes("--remote");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run admin:create -- --email nome@dominio.it --name "Nome" [--remote]');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Password (min 12 caratteri): ");
rl.close();
if (password.length < 12) {
  console.error("Password troppo corta.");
  process.exit(1);
}

const iter = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password.normalize("NFKC"), salt, iter, 32, "sha256");
const stored = `pbkdf2$sha256$${iter}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const sql = `INSERT INTO admin_users (id, email, name, password_hash) VALUES (${q(randomUUID())}, ${q(email)}, ${q(name)}, ${q(stored)})
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name;`;

execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(`\nUtente ${email} pronto${remote ? " (produzione)" : " (locale)"}.`);
