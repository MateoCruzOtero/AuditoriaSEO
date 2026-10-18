import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar de Competencia",
  description: "Vigilá qué cambia en la web de tu competencia y recibí un resumen semanal con qué igualar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const agency = process.env.AGENCY_NAME || "Mi Agencia";
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <header className="topbar no-print">
          <nav className="nav">
            <Link href="/" className="brand">
              <span className="brand-dot" /> Radar
            </Link>
            <Link href="/">Competencia</Link>
            <Link href="/prospectos">Prospectos</Link>
          </nav>
          <span className="muted hide-mobile">{agency}</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
