import { redirect } from "next/navigation";

export const metadata = { title: "Accesso amministratore", robots: { index: false } };
export const dynamic = "force-dynamic";

// Con le credenziali fisse la registrazione pubblica non è necessaria.
export default function SetupPage() {
  redirect("/admin/login");
}
