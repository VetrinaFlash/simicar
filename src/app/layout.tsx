import type { Metadata, Viewport } from "next";
import "./globals.css";

// Tutte le pagine leggono dati dal database: niente pre-rendering in fase di build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Noleggio auto e furgoni", template: "%s" },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1a3fa0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
