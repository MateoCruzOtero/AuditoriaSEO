import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { AddCompetitorForm } from "@/components/AddCompetitorForm";
import { ChangeList } from "@/components/ChangeList";
import { hasAnthropicCredentials } from "@/lib/ai";
import { hasChangedetection } from "@/lib/changedetection";
import { listCompetitors, listDigests } from "@/lib/db";
import { collectChanges } from "@/lib/monitor";
import type { ChangeEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompetitionPage() {
  const competitors = listCompetitors();
  const digests = listDigests(5);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let changes: ChangeEvent[] = [];
  let changesError: string | null = null;
  try {
    changes = await collectChanges(competitors, since);
  } catch (error) {
    changesError = error instanceof Error ? error.message : "Error desconocido";
  }

  const missing = [!hasChangedetection() && "changedetection", !hasAnthropicCredentials() && "Claude"].filter(Boolean);

  return (
    <>
      <div className="row">
        <div>
          <h1>Competencia</h1>
          <p className="muted" style={{ margin: 0 }}>
            Qué cambió en la web de tu competencia y qué conviene igualar.
          </p>
        </div>
        <span className="spacer" />
        <ActionButton
          endpoint="/api/digests"
          label="Generar resumen semanal"
          loadingLabel="Analizando… (puede tardar un minuto)"
          goTo="/resumenes/"
        />
      </div>

      {missing.length > 0 && (
        <div className="banner" style={{ marginTop: "1rem" }}>
          <strong>Modo demo:</strong> falta configurar {missing.join(" y ")} en <code>.env.local</code>, así que
          esa parte usa datos de ejemplo. Mirá el README para activarlo.
        </div>
      )}

      {digests.length > 0 && (
        <>
          <h2>Resúmenes</h2>
          <div className="card">
            {digests.map((d) => (
              <div key={d.id} className="check">
                <div>
                  <Link href={`/resumenes/${d.id}`}>
                    <strong>{d.data.titulo}</strong>
                  </Link>
                  <div className="muted small">
                    {new Date(d.periodFrom).toLocaleDateString("es-UY")} – {new Date(d.periodTo).toLocaleDateString("es-UY")}{" "}
                    · {d.changes.length} {d.changes.length === 1 ? "página cambió" : "páginas cambiaron"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row">
        <h2>Cambios de los últimos 7 días</h2>
        <span className="spacer" />
        {competitors.length > 0 && (
          <ActionButton endpoint="/api/recheck" label="Revisar ahora" loadingLabel="Pidiendo revisión…" ghost />
        )}
      </div>
      {changesError ? (
        <div className="error">No pudimos leer los cambios: {changesError}</div>
      ) : changes.length === 0 ? (
        <p className="muted">
          {competitors.length === 0
            ? "Agregá tu primer competidor abajo para empezar."
            : "Sin cambios todavía. La primera revisión guarda una “foto” de cada página; los cambios aparecen a partir de la segunda."}
        </p>
      ) : (
        <ChangeList changes={changes} />
      )}

      <h2>Competidores vigilados</h2>
      {competitors.map((c) => (
        <section key={c.id} className="card">
          <div className="row">
            <strong>{c.name}</strong>
            <span className="muted small">{c.website}</span>
            <span className="spacer" />
            <ActionButton
              endpoint={`/api/competitors/${c.id}`}
              method="DELETE"
              label="Dejar de vigilar"
              loadingLabel="Borrando…"
              confirm={`¿Dejar de vigilar a ${c.name}?`}
              ghost
            />
          </div>
          <ul className="small" style={{ margin: ".5rem 0 0", paddingLeft: "1.1rem" }}>
            {c.pages.map((p) => (
              <li key={p.id}>
                {p.label}:{" "}
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <AddCompetitorForm />
    </>
  );
}
