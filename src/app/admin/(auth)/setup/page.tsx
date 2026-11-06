import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Attivazione pannello", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(schema.adminUsers);
  if ((row?.n ?? 0) > 0) redirect("/admin/login");
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <div className="road-sign mb-6 px-7 py-6">
          <p className="text-sm font-medium text-white/75">Primo accesso</p>
          <p className="font-narrow mt-1 text-3xl font-black uppercase">Attiva il pannello</p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
