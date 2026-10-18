// Tipos compartidos: la forma de un informe de prospecto.

export type DomainMetrics = {
  domain: string;
  /** Visitas orgánicas estimadas por mes (ETV de DataForSEO). */
  traffic: number | null;
  /** Cantidad de palabras clave por las que aparece en Google. */
  keywords: number | null;
  /** Cuánto costaría comprar ese tráfico en Google Ads (USD/mes). */
  trafficValue: number | null;
};

export type KeywordRow = {
  keyword: string;
  searchVolume: number | null;
  position: number | null;
  traffic: number | null;
  url: string | null;
};

/** Palabra clave por la que un competidor aparece y el prospecto no. */
export type GapRow = KeywordRow & { competitor: string };

export type AuditCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type SiteAudit = {
  reachable: boolean;
  loadMs: number | null;
  checks: AuditCheck[];
};

export type AiInsights = {
  resumen: string;
  oportunidades: { titulo: string; detalle: string; impacto: "alto" | "medio" | "bajo" }[];
  email: { asunto: string; cuerpo: string };
  linkedin: string;
};

export type ReportData = {
  prospect: DomainMetrics;
  competitors: DomainMetrics[];
  topKeywords: KeywordRow[];
  gaps: GapRow[];
  audit: SiteAudit;
  insights: AiInsights;
  /** Qué partes se generaron con datos de ejemplo (sin claves de API). */
  demo: { seoData: boolean; ai: boolean };
  /** Costo de generar este informe, para controlar el margen. */
  cost: { dataforseoUsd: number; aiUsd: number };
};

export type ReportRow = {
  id: string;
  createdAt: string;
  domain: string;
  businessName: string | null;
  locationCode: number;
  status: "ok" | "error";
  error: string | null;
  data: ReportData | null;
};

// ---------------------------------------------------------------------------
// Vigilancia de la competencia
// ---------------------------------------------------------------------------

/** Una diferencia entre dos versiones de una página. */
export type DiffItem =
  | { type: "added"; text: string }
  | { type: "removed"; text: string }
  | { type: "changed"; before: string; after: string };

export type WatchedPage = {
  id: number;
  competitorId: number;
  label: string;
  url: string;
  /** Id de la página en changedetection (null en modo demo). */
  watchUuid: string | null;
};

export type Competitor = {
  id: number;
  name: string;
  website: string;
  createdAt: string;
  pages: WatchedPage[];
};

export type ChangeEvent = {
  competitor: string;
  pageLabel: string;
  url: string;
  /** ISO 8601 */
  at: string;
  items: DiffItem[];
};

export type DigestData = {
  titulo: string;
  resumen: string;
  porCompetidor: { competidor: string; movimientos: string[] }[];
  recomendaciones: { accion: string; porQue: string; prioridad: "alta" | "media" | "baja" }[];
};

export type Digest = {
  id: string;
  createdAt: string;
  periodFrom: string;
  periodTo: string;
  changes: ChangeEvent[];
  data: DigestData;
  demo: { changes: boolean; ai: boolean };
  aiCostUsd: number;
};
