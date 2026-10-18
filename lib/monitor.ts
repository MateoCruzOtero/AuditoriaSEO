import { getDiff, getSnapshotTimes, hasChangedetection } from "./changedetection";
import type { ChangeEvent, Competitor, DiffItem } from "./types";

/** Cuántos cambios por página leemos como máximo (los más recientes). */
const MAX_CHANGES_PER_PAGE = 10;

/**
 * Junta todo lo que cambió en las páginas vigiladas desde `since`.
 * Cada cambio es la diferencia entre una copia guardada y la anterior.
 */
export async function collectChanges(competitors: Competitor[], since: Date): Promise<ChangeEvent[]> {
  if (!hasChangedetection()) return demoChanges(competitors, since);

  const sinceSeconds = Math.floor(since.getTime() / 1000);
  const events: ChangeEvent[] = [];

  const pages = competitors.flatMap((c) => c.pages.map((page) => ({ competitor: c.name, page })));
  await Promise.all(
    pages.map(async ({ competitor, page }) => {
      if (!page.watchUuid) return;
      const times = await getSnapshotTimes(page.watchUuid);
      // La primera copia es la "foto inicial", no un cambio: arrancamos en 1.
      const recent = times
        .map((t, i) => ({ to: t, from: times[i - 1] }))
        .slice(1)
        .filter(({ to }) => Number(to) >= sinceSeconds)
        .slice(-MAX_CHANGES_PER_PAGE);
      for (const { from, to } of recent) {
        const items = await getDiff(page.watchUuid, from, to);
        if (items.length === 0) continue;
        events.push({
          competitor,
          pageLabel: page.label,
          url: page.url,
          at: new Date(Number(to) * 1000).toISOString(),
          items,
        });
      }
    }),
  );

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// MODO DEMO: cambios de ejemplo para ver cómo se ve sin instalar changedetection.
// ---------------------------------------------------------------------------

const DEMO_BY_LABEL: Record<string, DiffItem[]> = {
  precios: [
    { type: "changed", before: "Plan básico: $ 1.990 por mes", after: "Plan básico: $ 1.590 por mes (oferta lanzamiento)" },
    { type: "added", text: "Plan anual con 2 meses gratis" },
  ],
  promociones: [
    { type: "added", text: "Black Friday: 30% de descuento en todos los servicios hasta el domingo" },
    { type: "removed", text: "Envío gratis en compras mayores a $ 3.000" },
  ],
  servicios: [{ type: "added", text: "Nuevo: atención por WhatsApp las 24 horas" }],
  inicio: [
    { type: "changed", before: "Calidad y confianza desde 2010", after: "Líderes en Uruguay: más de 5.000 clientes" },
  ],
};

function demoChanges(competitors: Competitor[], since: Date): ChangeEvent[] {
  const span = Date.now() - since.getTime();
  const events: ChangeEvent[] = [];
  competitors.forEach((competitor, ci) => {
    competitor.pages.forEach((page, pi) => {
      const key = Object.keys(DEMO_BY_LABEL).find((k) => page.label.toLowerCase().includes(k)) ?? "inicio";
      events.push({
        competitor: competitor.name,
        pageLabel: page.label,
        url: page.url,
        at: new Date(Date.now() - ((ci * 3 + pi + 1) * span) / 12).toISOString(),
        items: DEMO_BY_LABEL[key],
      });
    });
  });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
