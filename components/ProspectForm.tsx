"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";

export function ProspectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const competitors = String(form.get("competitors") ?? "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 3);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: form.get("domain"),
          businessName: form.get("businessName"),
          competitors,
          locationCode: Number(form.get("locationCode")),
          offer: form.get("offer"),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Algo salió mal");
      router.push(`/reports/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}
      <div className="grid">
        <div className="field">
          <label htmlFor="domain">Sitio del prospecto *</label>
          <input id="domain" name="domain" placeholder="clinicadental.com.uy" required />
        </div>
        <div className="field">
          <label htmlFor="businessName">Nombre del negocio</label>
          <input id="businessName" name="businessName" placeholder="Clínica Dental Sonrisas" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="competitors">Competidores (opcional, hasta 3)</label>
        <input id="competitors" name="competitors" placeholder="competidor1.com, competidor2.com" />
        <div className="hint">Si lo dejás vacío, los buscamos automáticamente.</div>
      </div>
      <div className="grid">
        <div className="field">
          <label htmlFor="locationCode">País</label>
          <select id="locationCode" name="locationCode" defaultValue={DEFAULT_COUNTRY}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="offer">¿Qué le querés vender?</label>
          <input id="offer" name="offer" placeholder="posicionamiento en Google (SEO)" />
        </div>
      </div>
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Analizando… (puede tardar un minuto)" : "Generar diagnóstico"}
      </button>
    </form>
  );
}
