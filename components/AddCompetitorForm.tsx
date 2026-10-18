"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PageRow = { label: string; url: string };

const SUGGESTED_LABELS = ["Inicio", "Precios", "Promociones", "Servicios", "Productos", "Novedades"];

export function AddCompetitorForm() {
  const router = useRouter();
  const [rows, setRows] = useState<PageRow[]>([
    { label: "Inicio", url: "/" },
    { label: "Precios", url: "" },
    { label: "Promociones", url: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<PageRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          website: form.get("website"),
          pages: rows.filter((r) => r.label.trim() && r.url.trim()),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Algo salió mal");
      formElement.reset();
      setRows([
        { label: "Inicio", url: "/" },
        { label: "Precios", url: "" },
        { label: "Promociones", url: "" },
      ]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h3 style={{ marginTop: 0 }}>Agregar competidor</h3>
      {error && <div className="error">{error}</div>}
      <div className="grid">
        <div className="field">
          <label htmlFor="name">Nombre *</label>
          <input id="name" name="name" placeholder="Dental Pro" required />
        </div>
        <div className="field">
          <label htmlFor="website">Sitio web *</label>
          <input id="website" name="website" placeholder="dentalpro.com.uy" required />
        </div>
      </div>

      <label>Páginas a vigilar</label>
      <div className="hint" style={{ marginBottom: ".5rem" }}>
        Pegá la dirección completa o solo la parte final (por ejemplo <code>/precios</code>). Las filas vacías se ignoran.
      </div>
      <datalist id="page-labels">
        {SUGGESTED_LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="page-row">
          <input
            aria-label="Qué es"
            list="page-labels"
            value={row.label}
            onChange={(e) => updateRow(i, { label: e.target.value })}
            placeholder="Qué es"
          />
          <input
            aria-label="Dirección"
            value={row.url}
            onChange={(e) => updateRow(i, { url: e.target.value })}
            placeholder={`https://competidor.com/${row.label.toLowerCase() || "pagina"}`}
          />
        </div>
      ))}
      <div className="row" style={{ marginTop: ".75rem" }}>
        {rows.length < 8 && (
          <button type="button" className="btn btn-ghost" onClick={() => setRows([...rows, { label: "", url: "" }])}>
            + Otra página
          </button>
        )}
        <span className="spacer" />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Empezar a vigilar"}
        </button>
      </div>
    </form>
  );
}
