import Link from "next/link";
import { ProspectForm } from "@/components/ProspectForm";
import { findCountry } from "@/lib/countries";
import { listReports } from "@/lib/db";
import { hasAnthropicCredentials } from "@/lib/ai";
import { hasDataforseoCredentials } from "@/lib/dataforseo";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const reports = listReports();
  const missing = [
    !hasDataforseoCredentials() && "DataForSEO",
    !hasAnthropicCredentials() && "Claude",
  ].filter(Boolean);

  return (
    <>
      <h1>Nuevo prospecto</h1>
      <p className="muted">
        Analizamos el sitio, lo comparamos con su competencia y te damos el diagnóstico y el mensaje listo para enviar.
      </p>

      {missing.length > 0 && (
        <div className="banner">
          <strong>Modo demo:</strong> faltan las claves de {missing.join(" y ")} en <code>.env.local</code>, así que
          esa parte usa datos de ejemplo.
        </div>
      )}

      <ProspectForm />

      <h2>Informes anteriores</h2>
      {reports.length === 0 ? (
        <p className="muted">Todavía no generaste ninguno.</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prospecto</th>
                <th>País</th>
                <th className="num">Visitas/mes</th>
                <th className="num">Costo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/reports/${r.id}`}>{r.businessName ?? r.domain}</Link>
                    {r.businessName && <div className="muted small">{r.domain}</div>}
                  </td>
                  <td>{findCountry(r.locationCode)?.label ?? r.locationCode}</td>
                  <td className="num">{r.data?.prospect.traffic?.toLocaleString("es-UY") ?? "–"}</td>
                  <td className="num">
                    {r.data ? `US$ ${(r.data.cost.dataforseoUsd + r.data.cost.aiUsd).toFixed(3)}` : "–"}
                  </td>
                  <td className="muted small">{new Date(r.createdAt).toLocaleDateString("es-UY")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
