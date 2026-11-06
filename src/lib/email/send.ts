import "server-only";
import { getEnv } from "@/lib/env";

export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string };

export async function sendEmail(mail: Email): Promise<boolean> {
  const env = await getEnv();
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY mancante, email non inviata: "${mail.subject}" → ${mail.to}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend ha risposto", res.status, await res.text());
    return false;
  }
  return true;
}
