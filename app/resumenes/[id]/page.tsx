import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeList } from "@/components/ChangeList";
import { PrintButton } from "@/components/PrintButton";
import { getDigest } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const digest = getDigest(id);
  if (!digest) notFound();
  const { data } = digest;
  const isDemo = digest.demo.changes || digest.demo.ai;

  return (
    <>
      <div className="row no-print" style={{ marginBottom: "1rem" }}>
        <Link href="/">← Volver</Link>
        <span className="spacer" />
        <PrintButton />
      </div>

      {isDemo && (
        <div className="banner no-print">
          <strong>Resumen de demostración:</strong>{" "}
          {digest.demo.changes && "los cambios son de ejemplo (falta configurar changedetection). "}
          {digest.demo.ai && "El análisis sale de una plantilla (falta la clave de Claude)."}
        </div>
      )}

      <section className="card">
        <div className="muted small">
          Resumen de competencia · {new Date(digest.periodFrom).toLocaleDateString("es-UY")} al{" "}
          {new Date(digest.periodTo).toLocaleDateString("es-UY")}
        </div>
        <h1>{data.titulo}</h1>
        <p>{data.resumen}</p>
      </section>

      {data.recomendaciones.length > 0 && (
        <>
          <h2>Qué deberíamos hacer</h2>
          <section className="card">
            {data.recomendaciones.map((r, i) => (
              <div key={i} className="check">
                <span className={`pill ${r.prioridad}`}>{r.prioridad}</span>
                <div>
                  <strong>{r.accion}</strong>
                  <div className="muted">{r.porQue}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {data.porCompetidor.length > 0 && (
        <>
          <h2>Qué hizo cada competidor</h2>
          <div className="grid">
            {data.porCompetidor.map((c) => (
              <section key={c.competidor} className="card">
                <strong>{c.competidor}</strong>
                <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.1rem" }}>
                  {c.movimientos.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {digest.changes.length > 0 && (
        <>
          <h2>Detalle de los cambios</h2>
          <ChangeList changes={digest.changes} />
        </>
      )}

      {digest.aiCostUsd > 0 && (
        <p className="muted small no-print">Costo del análisis con IA: US$ {digest.aiCostUsd.toFixed(4)}</p>
      )}
    </>
  );
}
