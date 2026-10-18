import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AiInsights, DomainMetrics, GapRow, KeywordRow, SiteAudit } from "./types";

// Claude convierte los números en lenguaje de dueño de negocio y escribe el
// mensaje de contacto. Si no hay ANTHROPIC_API_KEY, usamos una plantilla.

export const MODEL = "claude-opus-5-5";
// Precio por millón de tokens (USD) para estimar el costo de cada informe.
const PRICE_INPUT_PER_MTOK = 4;
const PRICE_OUTPUT_PER_MTOK = 20;

export function estimateCostUsd(usage: { input_tokens: number; output_tokens: number }) {
  return (usage.input_tokens * PRICE_INPUT_PER_MTOK + usage.output_tokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
}

const InsightsSchema = z.object({
  resumen: z.string(),
  oportunidades: z.array(
    z.object({
      titulo: z.string(),
      detalle: z.string(),
      impacto: z.enum(["alto", "medio", "bajo"]),
    }),
  ),
  email: z.object({ asunto: z.string(), cuerpo: z.string() }),
  linkedin: z.string(),
});

export type InsightsInput = {
  prospect: DomainMetrics;
  businessName: string | null;
  country: string;
  offer: string;
  agencyName: string;
  competitors: DomainMetrics[];
  topKeywords: KeywordRow[];
  gaps: GapRow[];
  audit: SiteAudit;
};

export function hasAnthropicCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `Sos un consultor de marketing digital que prepara diagnósticos de prospección para una agencia.
Recibís datos SEO reales de un negocio (el "prospecto") y de sus competidores, y escribís en español rioplatense neutro, claro y sin jerga técnica: el lector es el dueño del negocio, no un experto en SEO.

Reglas:
- Usá solo los números que vienen en los datos. No inventes cifras, clientes ni resultados prometidos.
- Traducí métricas a consecuencias de negocio: "tu competidor X recibe unas 1.200 visitas al mes buscando 'Y' y vos no aparecés".
- "traffic" son visitas orgánicas mensuales estimadas; "trafficValue" es lo que costaría ese tráfico en Google Ads (USD/mes).
- resumen: 3 a 4 frases con el diagnóstico principal.
- oportunidades: entre 3 y 5, ordenadas de mayor a menor impacto, cada una concreta y accionable.
- email: un correo en frío breve (máximo 120 palabras), personal, que mencione 1 o 2 hallazgos concretos, ofrezca el servicio de la agencia y cierre con una pregunta simple para agendar 15 minutos. Firmá con el nombre de la agencia. Sin emojis.
- linkedin: un mensaje de conexión de máximo 280 caracteres.`;

export async function generateInsights(input: InsightsInput): Promise<{ insights: AiInsights; costUsd: number }> {
  if (!hasAnthropicCredentials()) {
    return { insights: templateInsights(input), costUsd: 0 };
  }

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(InsightsSchema) },
    // Si el modelo rechaza el pedido por una política de seguridad, la API
    // reintenta sola con otro modelo en vez de devolver el rechazo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Agencia: ${input.agencyName}
Servicio que ofrece la agencia: ${input.offer}
País del prospecto: ${input.country}
Nombre del negocio: ${input.businessName ?? "(no informado, usá el dominio)"}

Datos (JSON):
${JSON.stringify(
  {
    prospecto: input.prospect,
    competidores: input.competitors,
    palabrasClaveDelProspecto: input.topKeywords,
    palabrasQueLeGananLosCompetidores: input.gaps,
    auditoriaDelSitio: {
      abre: input.audit.reachable,
      problemas: input.audit.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
    },
  },
  null,
  2,
)}`,
      },
    ],
  });

  const costUsd = estimateCostUsd(response.usage);

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    // Nunca dejamos al usuario sin informe: caemos a la plantilla.
    console.warn(`Claude no devolvió el análisis (stop_reason=${response.stop_reason}); uso la plantilla.`);
    return { insights: templateInsights(input), costUsd };
  }
  return { insights: response.parsed_output, costUsd };
}

// ---------------------------------------------------------------------------
// Plantilla sin IA: se usa en modo demo o si la IA falla.
// ---------------------------------------------------------------------------

function fmt(n: number | null) {
  return n === null ? "s/d" : n.toLocaleString("es-UY");
}

export function templateInsights(input: InsightsInput): AiInsights {
  const name = input.businessName ?? input.prospect.domain;
  const leader = [...input.competitors].sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))[0];
  const topGap = input.gaps[0];
  const problems = input.audit.checks.filter((c) => !c.ok);

  const oportunidades: AiInsights["oportunidades"] = [];
  if (topGap) {
    oportunidades.push({
      titulo: `Aparecer cuando buscan "${topGap.keyword}"`,
      detalle: `${topGap.competitor} recibe unas ${fmt(topGap.traffic)} visitas al mes con esa búsqueda (${fmt(topGap.searchVolume)} búsquedas mensuales) y ${name} no aparece.`,
      impacto: "alto",
    });
  }
  if (leader && (leader.traffic ?? 0) > (input.prospect.traffic ?? 0)) {
    oportunidades.push({
      titulo: `Achicar la distancia con ${leader.domain}`,
      detalle: `${leader.domain} tiene unas ${fmt(leader.traffic)} visitas orgánicas al mes contra ${fmt(input.prospect.traffic)} de ${name}.`,
      impacto: "alto",
    });
  }
  for (const problem of problems.slice(0, 3)) {
    oportunidades.push({ titulo: `Corregir: ${problem.label}`, detalle: problem.detail, impacto: "medio" });
  }

  const hallazgo = topGap
    ? `noté que ${topGap.competitor} aparece en Google cuando buscan "${topGap.keyword}" y ustedes no`
    : leader
      ? `noté que ${leader.domain} recibe bastante más tráfico desde Google que ustedes`
      : `encontré ${problems.length} puntos técnicos para mejorar en su sitio`;

  return {
    resumen: `${name} recibe unas ${fmt(input.prospect.traffic)} visitas orgánicas al mes y aparece en Google por ${fmt(input.prospect.keywords)} búsquedas. ${
      leader ? `Su competidor más fuerte, ${leader.domain}, recibe ${fmt(leader.traffic)}.` : ""
    } Encontramos ${input.gaps.length} búsquedas donde la competencia aparece y ${name} no, y ${problems.length} ${problems.length === 1 ? "problema técnico" : "problemas técnicos"} en el sitio.`,
    oportunidades,
    email: {
      asunto: `Una oportunidad en Google para ${name}`,
      cuerpo: `Hola, ¿cómo están?\n\nEstuve mirando cómo aparece ${name} en Google y ${hallazgo}. Preparé un diagnóstico corto con las oportunidades más claras.\n\nEn ${input.agencyName} ayudamos a negocios como el suyo con ${input.offer}. ¿Les sirve una llamada de 15 minutos esta semana para mostrárselo?\n\nSaludos,\n${input.agencyName}`,
    },
    linkedin: `Hola, preparé un diagnóstico de cómo aparece ${name} en Google frente a su competencia: hay oportunidades claras. ¿Te lo comparto?`,
  };
}
