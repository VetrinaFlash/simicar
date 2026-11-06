import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const [env, { next }, s] = await Promise.all([getEnv(), searchParams, getSettings()]);
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="road-sign mb-6 px-7 py-6">
          <p className="text-sm font-medium text-white/75">Pannello di gestione</p>
          <p className="font-narrow mt-1 text-3xl font-black uppercase">{s.businessName}</p>
        </div>
        <LoginForm next={next} configured={Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 8)} />
      </div>
    </main>
  );
}
