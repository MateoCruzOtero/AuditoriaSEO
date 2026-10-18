import { generateInsights, hasAnthropicCredentials } from "./ai";
import {
  DataforseoClient,
  demoCompetitors,
  demoGap,
  demoKeywords,
  demoOverview,
  hasDataforseoCredentials,
  type Market,
} from "./dataforseo";
import { auditSite } from "./site-audit";
import type { DomainMetrics, GapRow, KeywordRow, ReportData } from "./types";

export type AnalyzeInput = {
  domain: string;
  businessName: string | null;
  competitors: string[]; // vacío = los buscamos automáticamente
  market: Market;
  countryLabel: string;
  offer: string;
};

/**
 * El corazón del producto: junta datos SEO, audita el sitio y le pide a la IA
 * el diagnóstico y el mensaje de contacto.
 */
export async function analyzeProspect(input: AnalyzeInput): Promise<ReportData> {
  const useDemoData = !hasDataforseoCredentials();
  const agencyName = process.env.AGENCY_NAME || "Mi Agencia";

  // La auditoría del sitio es gratis y no depende de DataForSEO: la largamos en paralelo.
  const auditPromise = auditSite(input.domain);

  let prospect: DomainMetrics;
  let competitors: DomainMetrics[];
  let topKeywords: KeywordRow[];
  let gaps: GapRow[];
  let dataforseoUsd = 0;

  if (useDemoData) {
    const competitorDomains = input.competitors.length ? input.competitors : demoCompetitors(input.domain);
    prospect = demoOverview(input.domain, 0.5);
    competitors = competitorDomains.map((d) => demoOverview(d, 1.2));
    topKeywords = demoKeywords(input.domain);
    gaps = competitorDomains.flatMap((d) => demoGap(d, 4));
  } else {
    const dfs = new DataforseoClient();
    const competitorDomains = input.competitors.length
      ? input.competitors
      : await dfs.findCompetitors(input.domain, input.market);

    [prospect, competitors, topKeywords, gaps] = await Promise.all([
      dfs.domainOverview(input.domain, input.market),
      Promise.all(competitorDomains.map((d) => dfs.domainOverview(d, input.market))),
      dfs.topKeywords(input.domain, input.market),
      Promise.all(competitorDomains.map((d) => dfs.keywordGap(d, input.domain, input.market, 8))).then((lists) =>
        lists.flat(),
      ),
    ]);
    dataforseoUsd = dfs.spentUsd;
  }

  // Nos quedamos con las brechas más valiosas, sin repetir palabra clave.
  const seen = new Set<string>();
  gaps = gaps
    .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))
    .filter((g) => g.keyword && !seen.has(g.keyword) && seen.add(g.keyword))
    .slice(0, 12);

  const audit = await auditPromise;

  const { insights, costUsd } = await generateInsights({
    prospect,
    businessName: input.businessName,
    country: input.countryLabel,
    offer: input.offer,
    agencyName,
    competitors,
    topKeywords,
    gaps,
    audit,
  });

  return {
    prospect,
    competitors,
    topKeywords,
    gaps,
    audit,
    insights,
    demo: { seoData: useDemoData, ai: !hasAnthropicCredentials() },
    cost: { dataforseoUsd, aiUsd: costUsd },
  };
}
