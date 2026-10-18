import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PrintButton } from "@/components/PrintButton";
import { findCountry } from "@/lib/countries";
import { getReport } from "@/lib/db";
import type { DomainMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmt(n: number | null | undefined) {
  return n === null || n === undefined ? "–" : n.toLocaleString("es-UY");
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = getReport(id);
  if (!report || !report.data) notFound();

  const data = report.data;
  const name = report.businessName ?? report.domain;
  const agency = process.env.AGENCY_NAME || "Mi Agencia";
  const contact = process.env.AGENCY_CONTACT;
  const everyone: (DomainMetrics & { you: boolean })[] = [
    { ...data.prospect, you: true },
    ...data.competitors.map((c) => ({ ...c, you: false })),
  ];
  const maxTraffic = Math.max(1, ...everyone.map((d) => d.traffic ?? 0));
  const failedChecks = data.audit.checks.filter((c) => !c.ok).length;
  const isDemo = data.demo.seoData || data.demo.ai;

  return (
    <>
      <div className="row no-print" style={{ marginBottom: "1rem" }}>
        <Link href="/">← Volver</Link>
        <span className="spacer" />
        <PrintButton />
      </div>

      {isDemo && (
        <div className="banner no-print">
          <strong>Informe de demostración:</strong>{" "}
          {data.demo.seoData && "los datos SEO son de ejemplo (falta la clave de DataForSEO). "}
          {data.demo.ai && "Los textos salen de una plantilla (falta la clave de Claude)."}
        </div>
      )}

      {/* ---------- Lo que ve el cliente ---------- */}
      <section className="card">
        <div className="muted small">
          Diagnóstico preparado por {agency} · {new Date(report.createdAt).toLocaleDateString("es-UY")} ·{" "}
          {findCountry(report.locationCode)?.label}
        </div>
        <h1>{name}</h1>
        <div className="muted">{report.domain}</div>
        <p style={{ marginTop: "1rem" }}>{data.insights.resumen}</p>
      </section>

      <div className="grid">
        <div className="card">
          <div className="stat-label">Visitas desde Google / mes</div>
          <div className="stat-value">{fmt(data.prospect.traffic)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Búsquedas donde aparece</div>
          <div className="stat-value">{fmt(data.prospect.keywords)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Valor de ese tráfico en Ads</div>
          <div className="stat-value">US$ {fmt(data.prospect.trafficValue)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Problemas técnicos</div>
          <div className="stat-value">
            {failedChecks} / {data.audit.checks.length}
          </div>
        </div>
      </div>

      <h2>Oportunidades principales</h2>
      <section className="card">
        {data.insights.oportunidades.map((o, i) => (
          <div key={i} className="check">
            <span className={`pill ${o.impacto}`}>{o.impacto}</span>
            <div>
              <strong>{o.titulo}</strong>
              <div className="muted">{o.detalle}</div>
            </div>
          </div>
        ))}
      </section>

      {data.competitors.length > 0 && (
        <>
          <h2>Frente a la competencia</h2>
          <section className="card">
            {everyone.map((d) => (
              <div key={d.domain} style={{ marginBottom: ".9rem" }}>
                <div className="row">
                  <strong>{d.you ? `${d.domain} (vos)` : d.domain}</strong>
                  <span className="spacer" />
                  <span className="muted small">
                    {fmt(d.traffic)} visitas/mes · {fmt(d.keywords)} búsquedas
                  </span>
                </div>
                <div className={`bar ${d.you ? "you" : ""}`}>
                  <span style={{ width: `${((d.traffic ?? 0) / maxTraffic) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {data.gaps.length > 0 && (
        <>
          <h2>Búsquedas donde la competencia aparece y vos no</h2>
          <section className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Búsqueda</th>
                  <th>Quién aparece</th>
                  <th className="num">Posición</th>
                  <th className="num">Búsquedas/mes</th>
                  <th className="num">Visitas que se lleva</th>
                </tr>
              </thead>
              <tbody>
                {data.gaps.map((g) => (
                  <tr key={g.keyword}>
                    <td>{g.keyword}</td>
                    <td>{g.competitor}</td>
                    <td className="num">{fmt(g.position)}</td>
                    <td className="num">{fmt(g.searchVolume)}</td>
                    <td className="num">{fmt(g.traffic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {data.topKeywords.length > 0 && (
        <>
          <h2>Lo que hoy te trae visitas</h2>
          <section className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Búsqueda</th>
                  <th className="num">Posición</th>
                  <th className="num">Búsquedas/mes</th>
                  <th className="num">Visitas</th>
                </tr>
              </thead>
              <tbody>
                {data.topKeywords.map((k) => (
                  <tr key={k.keyword}>
                    <td>{k.keyword}</td>
                    <td className="num">{fmt(k.position)}</td>
                    <td className="num">{fmt(k.searchVolume)}</td>
                    <td className="num">{fmt(k.traffic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <h2>Revisión técnica del sitio</h2>
      <section className="card">
        {data.audit.checks.map((c) => (
          <div key={c.id} className="check">
            <span className={`check-icon ${c.ok ? "ok" : "bad"}`}>{c.ok ? "✓" : "✗"}</span>
            <div>
              <strong>{c.label}</strong>
              <div className="muted small">{c.detail}</div>
            </div>
          </div>
        ))}
      </section>

      <p className="muted small">
        {agency}
        {contact ? ` · ${contact}` : ""} · Cifras estimadas a partir de datos públicos de búsqueda.
      </p>

      {/* ---------- Solo para uso interno (no sale en el PDF) ---------- */}
      <div className="no-print">
        <h2>Mensajes de contacto</h2>
        <section className="card">
          <div className="row">
            <strong>Email · {data.insights.email.asunto}</strong>
            <span className="spacer" />
            <CopyButton text={`Asunto: ${data.insights.email.asunto}\n\n${data.insights.email.cuerpo}`} />
          </div>
          <p className="message">{data.insights.email.cuerpo}</p>
        </section>
        <section className="card">
          <div className="row">
            <strong>LinkedIn</strong>
            <span className="spacer" />
            <CopyButton text={data.insights.linkedin} />
          </div>
          <p className="message">{data.insights.linkedin}</p>
        </section>

        <h2>Costo de este informe</h2>
        <section className="card small">
          DataForSEO: US$ {data.cost.dataforseoUsd.toFixed(4)} · IA: US$ {data.cost.aiUsd.toFixed(4)} ·{" "}
          <strong>Total: US$ {(data.cost.dataforseoUsd + data.cost.aiUsd).toFixed(4)}</strong>
        </section>
      </div>
    </>
  );
}
