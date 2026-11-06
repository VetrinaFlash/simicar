import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const db = await getDb();
  const [[users], { next }, s] = await Promise.all([db.select({ n: count() }).from(schema.adminUsers), searchParams, getSettings()]);
  if ((users?.n ?? 0) === 0) redirect("/admin/setup");
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="road-sign mb-6 px-7 py-6">
          <p className="text-sm font-medium text-white/75">Pannello di gestione</p>
          <p className="font-narrow mt-1 text-3xl font-black uppercase">{s.businessName}</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
