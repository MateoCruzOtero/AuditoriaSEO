"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Botón que llama a la API y después refresca la pantalla o navega.
 * Se usa para "Generar resumen", "Revisar ahora" y "Dejar de vigilar".
 */
export function ActionButton(props: {
  endpoint: string;
  method?: "POST" | "DELETE";
  label: string;
  loadingLabel: string;
  /** Si la respuesta trae un id, navegar a esta ruta + id. */
  goTo?: string;
  confirm?: string;
  ghost?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (props.confirm && !window.confirm(props.confirm)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(props.endpoint, {
        method: props.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Algo salió mal");
      if (props.goTo && json.id) router.push(`${props.goTo}${json.id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button type="button" className={`btn ${props.ghost ? "btn-ghost" : ""}`} onClick={onClick} disabled={loading}>
        {loading ? props.loadingLabel : props.label}
      </button>
      {error && <div className="error small" style={{ marginTop: ".5rem" }}>{error}</div>}
    </span>
  );
}
