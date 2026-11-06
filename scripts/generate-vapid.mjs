// Genera la coppia di chiavi VAPID per le notifiche push.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const b = (s) => Buffer.from(s, "base64url");
const raw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]).toString("base64url");

console.log(`VAPID_PUBLIC_KEY=${raw}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
console.log("\nIn produzione:\n  npx wrangler secret put VAPID_PUBLIC_KEY\n  npx wrangler secret put VAPID_PRIVATE_KEY");
