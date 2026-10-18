import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { estimateCostUsd, hasAnthropicCredentials, MODEL } from "./ai";
import { hasChangedetection } from "./changedetection";
import { listCompetitors, saveDigest } from "./db";
import { collectChanges } from "./monitor";
import type { ChangeEvent, Digest, DigestData, DiffItem } from "./types";

// El resumen semanal: toma todos los cambios de la competencia y la IA los
// convierte en "qué hicieron" y "qué deberíamos igualar nosotros".

const DigestSchema = z.object({
  titulo: z.string(),
  resumen: z.string(),
  porCompetidor: z.array(z.object({ competidor: z.string(), movimientos: z.array(z.string()) })),
  recomendaciones: z.array(
    z.object({ accion: z.string(), porQue: z.string(), prioridad: z.enum(["alta", "media", "baja"]) }),
  ),
});

const SYSTEM_PROMPT = `Sos el analista de competencia de una empresa. Cada semana recibís los cambios detectados en las páginas web de sus competidores (precios, promociones, servicios, textos) y escribís un resumen para el dueño, en español claro y directo.

Reglas:
- Basate solo en los cambios recibidos. No inventes movimientos ni cifras.
- Ignorá cambios irrelevantes (fechas, contadores, cookies, textos legales menores) salvo que revelen algo.
- titulo: una frase que resuma la semana.
- resumen: 2 a 4 frases con lo más importante.
- porCompetidor: para cada competidor con cambios relevantes, sus movimientos en frases cortas y concretas ("Bajó el plan básico de $1.990 a $1.590").
- recomendaciones: entre 2 y 5 acciones concretas para igualar o superar a la competencia y no quedarse atrás, ordenadas por prioridad. Explicá el porqué en una frase. Si no hay nada que amerite reaccionar, decilo con una sola recomendación de prioridad baja.`;

/** Recorta cada línea larga para que el pedido a la IA no se dispare de costo. */
function describeItem(item: DiffItem) {
  const cut = (t: string) => (t.length > 300 ? `${t.slice(0, 300)}… (recortado)` : t);
  if (item.type === "changed") return `CAMBIÓ: "${cut(item.before)}" → "${cut(item.after)}"`;
  return `${item.type === "added" ? "NUEVO" : "QUITADO"}: "${cut(item.text)}"`;
}

function describeChanges(changes: ChangeEvent[]) {
  return changes
    .map(
      (c) =>
        `## ${c.competitor} · ${c.pageLabel} (${c.url}) · ${c.at.slice(0, 10)}\n` +
        c.items.slice(0, 30).map((i) => `- ${describeItem(i)}`).join("\n"),
    )
    .join("\n\n");
}

export async function createDigest(days = 7): Promise<Digest> {
  const periodTo = new Date();
  const periodFrom = new Date(periodTo.getTime() - days * 24 * 60 * 60 * 1000);
  const competitors = listCompetitors();
  const changes = await collectChanges(competitors, periodFrom);

  let data: DigestData;
  let aiCostUsd = 0;
  if (changes.length === 0) {
    data = {
      titulo: "Semana tranquila",
      resumen: "No detectamos cambios en las páginas de la competencia en este período.",
      porCompetidor: [],
      recomendaciones: [],
    };
  } else if (!hasAnthropicCredentials()) {
    data = templateDigest(changes);
  } else {
    const company = process.env.COMPANY_DESCRIPTION || "(sin descripción: dar recomendaciones generales)";
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: betaZodOutputFormat(DigestSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Nuestra empresa: ${company}\nPeríodo: ${periodFrom.toISOString().slice(0, 10)} a ${periodTo.toISOString().slice(0, 10)}\n\nCambios detectados:\n\n${describeChanges(changes)}`,
        },
      ],
    });
    aiCostUsd = estimateCostUsd(response.usage);
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.warn(`Claude no devolvió el resumen (stop_reason=${response.stop_reason}); uso la plantilla.`);
      data = templateDigest(changes);
    } else {
      data = response.parsed_output;
    }
  }

  const digest: Digest = {
    id: randomUUID(),
    createdAt: periodTo.toISOString(),
    periodFrom: periodFrom.toISOString(),
    periodTo: periodTo.toISOString(),
    changes,
    data,
    demo: { changes: !hasChangedetection(), ai: !hasAnthropicCredentials() },
    aiCostUsd,
  };
  saveDigest(digest);
  return digest;
}

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Resumen sin IA: lista los cambios tal cual. */
function templateDigest(changes: ChangeEvent[]): DigestData {
  const byCompetitor = new Map<string, string[]>();
  for (const change of changes) {
    const list = byCompetitor.get(change.competitor) ?? [];
    for (const item of change.items.slice(0, 5)) list.push(`${change.pageLabel}: ${describeItem(item)}`);
    byCompetitor.set(change.competitor, list);
  }
  return {
    titulo: `${plural(changes.length, "página cambió", "páginas cambiaron")} en ${plural(byCompetitor.size, "competidor", "competidores")}`,
    resumen:
      "Este resumen lista los cambios sin analizarlos. Agregá la clave de Claude para recibir el análisis y las recomendaciones.",
    porCompetidor: [...byCompetitor].map(([competidor, movimientos]) => ({ competidor, movimientos })),
    recomendaciones: [],
  };
}
