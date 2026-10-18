import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prospector SEO",
  description: "Diagnósticos SEO de prospectos con mensaje de contacto listo para enviar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const agency = process.env.AGENCY_NAME || "Mi Agencia";
  return (
    <html lang="es">
      <body>
        <header className="topbar no-print">
          <Link href="/" className="brand">
            <span className="brand-dot" /> Prospector SEO
          </Link>
          <span className="muted">{agency}</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
