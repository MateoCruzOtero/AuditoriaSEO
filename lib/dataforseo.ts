import type { DomainMetrics, GapRow, KeywordRow } from "./types";

// Cliente mínimo de DataForSEO Labs. Los nombres de campos son los mismos que
// usa open-seo (github.com/every-app/open-seo), que ya los probó en producción.
// Cada llamada cuesta dinero: anotamos el costo para calcular el margen.

const BASE_URL = "https://api.dataforseo.com";

export type Market = { locationCode: number; languageCode: string };

/** Sitios gigantes que "compiten" con todos y no sirven como competidores reales. */
const GENERIC_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "instagram.com", "wikipedia.org",
  "es.wikipedia.org", "linkedin.com", "twitter.com", "x.com", "tiktok.com",
  "amazon.com", "mercadolibre.com", "mercadolibre.com.uy", "mercadolibre.com.ar",
  "pinterest.com", "reddit.com", "tripadvisor.com", "yelp.com", "apple.com",
]);

export function hasDataforseoCredentials() {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export class DataforseoClient {
  /** Suma en USD de todo lo que gastamos con este cliente. */
  spentUsd = 0;

  private readonly auth: string;

  constructor() {
    const login = process.env.DATAFORSEO_LOGIN ?? "";
    const password = process.env.DATAFORSEO_PASSWORD ?? "";
    this.auth = Buffer.from(`${login}:${password}`).toString("base64");
  }

  /** Hace un POST y devuelve `tasks[0].result[0]` (o null si no hubo resultados). */
  private async post(path: string, payload: Record<string, unknown>): Promise<any> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${this.auth}` },
      body: JSON.stringify([payload]),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401) {
      throw new Error("DataForSEO rechazó las credenciales: revisá DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD.");
    }
    if (!response.ok) throw new Error(`DataForSEO respondió HTTP ${response.status} en ${path}`);

    const json = await response.json();
    const task = json?.tasks?.[0];
    this.spentUsd += Number(task?.cost ?? 0);

    // "No Search Results" no es un error: el dominio simplemente no tiene datos.
    const noResults = String(task?.status_message ?? "").toLowerCase().includes("no search results");
    if (!task || (task.status_code !== 20000 && !noResults)) {
      throw new Error(`DataForSEO ${task?.status_code ?? "?"} en ${path}: ${task?.status_message ?? "sin tarea"}`);
    }
    return task.result?.[0] ?? null;
  }

  async domainOverview(domain: string, market: Market): Promise<DomainMetrics> {
    const result = await this.post("/v3/dataforseo_labs/google/domain_rank_overview/live", {
      target: domain,
      location_code: market.locationCode,
      language_code: market.languageCode,
      limit: 1,
    });
    const organic = result?.items?.[0]?.metrics?.organic;
    return {
      domain,
      traffic: roundOrNull(organic?.etv),
      keywords: roundOrNull(organic?.count),
      trafficValue: roundOrNull(organic?.estimated_paid_traffic_cost),
    };
  }

  /** Las palabras clave que más tráfico le traen al dominio. */
  async topKeywords(domain: string, market: Market, limit = 10): Promise<KeywordRow[]> {
    const result = await this.post("/v3/dataforseo_labs/google/ranked_keywords/live", {
      target: domain,
      location_code: market.locationCode,
      language_code: market.languageCode,
      item_types: ["organic"],
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
      limit,
    });
    return (result?.items ?? []).map((item: any): KeywordRow => {
      const serp = item?.ranked_serp_element?.serp_item;
      return {
        keyword: item?.keyword_data?.keyword ?? "",
        searchVolume: item?.keyword_data?.keyword_info?.search_volume ?? null,
        position: serp?.rank_group ?? serp?.rank_absolute ?? null,
        traffic: roundOrNull(serp?.etv),
        url: serp?.url ?? null,
      };
    });
  }

  /** Encuentra automáticamente los dominios que compiten por las mismas búsquedas. */
  async findCompetitors(domain: string, market: Market, limit = 3): Promise<string[]> {
    const result = await this.post("/v3/dataforseo_labs/google/competitors_domain/live", {
      target: domain,
      location_code: market.locationCode,
      language_code: market.languageCode,
      limit: 15,
    });
    return (result?.items ?? [])
      .map((item: any) => String(item?.domain ?? "").replace(/^www\./, ""))
      .filter((d: string) => d && d !== domain && !GENERIC_DOMAINS.has(d))
      .slice(0, limit);
  }

  /** Palabras clave por las que aparece el competidor y el prospecto NO. */
  async keywordGap(competitor: string, prospect: string, market: Market, limit = 10): Promise<GapRow[]> {
    const result = await this.post("/v3/dataforseo_labs/google/domain_intersection/live", {
      target1: competitor,
      target2: prospect,
      intersections: false,
      item_types: ["organic"],
      location_code: market.locationCode,
      language_code: market.languageCode,
      limit,
    });
    return (result?.items ?? [])
      .map((item: any): GapRow => {
        const serp = item?.first_domain_serp_element;
        return {
          competitor,
          keyword: item?.keyword_data?.keyword ?? "",
          searchVolume: item?.keyword_data?.keyword_info?.search_volume ?? null,
          position: serp?.rank_group ?? serp?.rank_absolute ?? null,
          traffic: roundOrNull(serp?.etv),
          url: serp?.url ?? null,
        };
      })
      .sort((a: GapRow, b: GapRow) => (b.traffic ?? 0) - (a.traffic ?? 0));
  }
}

function roundOrNull(value: unknown): number | null {
  return typeof value === "number" ? Math.round(value) : null;
}

// ---------------------------------------------------------------------------
// MODO DEMO: datos inventados pero estables (el mismo dominio da siempre los
// mismos números). Sirve para probar la app y mostrarla sin gastar plata.
// ---------------------------------------------------------------------------

function seededRandom(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const DEMO_TOPICS = [
  "precios", "cerca de mi", "opiniones", "turno online", "presupuesto", "urgencias",
  "mejor", "barato", "horarios", "a domicilio", "consulta gratis", "promociones",
];

function demoBase(domain: string) {
  return domain.split(".")[0].replace(/-/g, " ");
}

export function demoOverview(domain: string, strength = 1): DomainMetrics {
  const rnd = seededRandom(domain);
  const traffic = Math.round((300 + rnd() * 4000) * strength);
  return {
    domain,
    traffic,
    keywords: Math.round(traffic / (3 + rnd() * 4)),
    trafficValue: Math.round(traffic * (0.3 + rnd() * 0.9)),
  };
}

export function demoKeywords(domain: string, limit = 10): KeywordRow[] {
  const rnd = seededRandom(`${domain}-kw`);
  const base = demoBase(domain);
  return DEMO_TOPICS.slice(0, limit)
    .map((topic) => {
      const searchVolume = Math.round(50 + rnd() * 2400);
      const position = 1 + Math.floor(rnd() * 25);
      return {
        keyword: `${base} ${topic}`,
        searchVolume,
        position,
        traffic: Math.round(searchVolume * Math.max(0.01, 0.3 - position * 0.012)),
        url: `https://${domain}/`,
      };
    })
    .sort((a, b) => b.traffic - a.traffic);
}

export function demoCompetitors(domain: string): string[] {
  const base = demoBase(domain).replace(/ /g, "");
  return [`${base}pro.com`, `el${base}.com`, `${base}online.com`];
}

export function demoGap(competitor: string, limit = 5): GapRow[] {
  return demoKeywords(competitor, limit)
    .map((row) => ({ ...row, competitor, url: `https://${competitor}/` }))
    .slice(0, limit);
}
