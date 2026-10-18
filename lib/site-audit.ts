import type { AuditCheck, SiteAudit } from "./types";

// Auditoría rápida y GRATIS de la página de inicio: no usa ninguna API paga,
// solo descarga el HTML y revisa lo básico que cualquier cliente entiende.

const USER_AGENT = "Mozilla/5.0 (compatible; ProspectorSEO/0.1)";

async function fetchText(url: string, timeoutMs = 10_000) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { response, text: await response.text() };
}

async function exists(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function firstMatch(html: string, regex: RegExp) {
  return regex.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function metaContent(html: string, name: string) {
  // Acepta el atributo content antes o después de name/property.
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (new RegExp(`(name|property)\\s*=\\s*["']${name}["']`, "i").test(tag)) {
      return firstMatch(tag, /content\s*=\s*["']([^"']*)["']/i);
    }
  }
  return null;
}

export async function auditSite(domain: string): Promise<SiteAudit> {
  const started = Date.now();
  let html: string;
  let finalUrl: string;
  try {
    const { response, text } = await fetchText(`https://${domain}/`);
    html = text;
    finalUrl = response.url;
  } catch {
    return {
      reachable: false,
      loadMs: null,
      checks: [
        {
          id: "reachable",
          label: "El sitio abre",
          ok: false,
          detail: "No pudimos abrir el sitio por HTTPS. Puede estar caído o sin certificado de seguridad.",
        },
      ],
    };
  }
  const loadMs = Date.now() - started;
  const origin = new URL(finalUrl).origin;
  const [hasRobots, hasSitemap] = await Promise.all([
    exists(`${origin}/robots.txt`),
    exists(`${origin}/sitemap.xml`),
  ]);
  return { reachable: true, loadMs, checks: buildChecks({ html, finalUrl, loadMs, hasRobots, hasSitemap }) };
}

/** Revisa el HTML ya descargado. Está separada para poder probarla sin internet. */
export function buildChecks(page: {
  html: string;
  finalUrl: string;
  loadMs: number;
  hasRobots: boolean;
  hasSitemap: boolean;
}): AuditCheck[] {
  const { html, finalUrl, loadMs, hasRobots, hasSitemap } = page;
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = metaContent(html, "description");
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithoutAlt = images.filter((img) => !/\balt\s*=\s*["'][^"']+["']/i.test(img)).length;

  return [
    {
      id: "https",
      label: "Conexión segura (HTTPS)",
      ok: finalUrl.startsWith("https://"),
      detail: finalUrl.startsWith("https://")
        ? "El sitio usa HTTPS."
        : "El sitio redirige a HTTP: Google y los navegadores lo marcan como inseguro.",
    },
    {
      id: "speed",
      label: "Velocidad de respuesta",
      ok: loadMs < 2500,
      detail: `La página principal tardó ${(loadMs / 1000).toFixed(1)} s en responder${loadMs < 2500 ? "." : ": es lento, y los visitantes se van."}`,
    },
    {
      id: "title",
      label: "Título de la página",
      ok: Boolean(title && title.length >= 20 && title.length <= 65),
      detail: !title
        ? "La página no tiene título: es lo primero que Google muestra en los resultados."
        : `"${title}" (${title.length} caracteres; lo ideal es entre 20 y 65).`,
    },
    {
      id: "description",
      label: "Descripción para Google",
      ok: Boolean(description && description.length >= 70 && description.length <= 160),
      detail: !description
        ? "Falta la meta descripción: Google inventa un texto, que casi nunca vende."
        : `${description.length} caracteres (lo ideal es entre 70 y 160).`,
    },
    {
      id: "h1",
      label: "Encabezado principal (H1)",
      ok: h1Count === 1,
      detail:
        h1Count === 0
          ? "No hay encabezado H1: Google no tiene claro de qué trata la página."
          : h1Count === 1
            ? "Tiene un único H1, correcto."
            : `Tiene ${h1Count} H1; lo recomendable es uno solo.`,
    },
    {
      id: "viewport",
      label: "Adaptado a celulares",
      ok: metaContent(html, "viewport") !== null,
      detail:
        metaContent(html, "viewport") !== null
          ? "Declara la configuración para celulares."
          : "No declara configuración para celulares: probablemente se ve mal en el teléfono.",
    },
    {
      id: "images",
      label: "Imágenes descritas (alt)",
      ok: imagesWithoutAlt === 0,
      detail:
        images.length === 0
          ? "No encontramos imágenes en el HTML inicial."
          : `${imagesWithoutAlt} de ${images.length} imágenes no tienen texto alternativo.`,
    },
    {
      id: "social",
      label: "Vista previa al compartir",
      ok: metaContent(html, "og:title") !== null,
      detail:
        metaContent(html, "og:title") !== null
          ? "Tiene etiquetas Open Graph para WhatsApp y redes."
          : "Sin etiquetas Open Graph: al compartir el link en WhatsApp o redes no aparece una vista previa linda.",
    },
    {
      id: "robots",
      label: "Archivo robots.txt",
      ok: hasRobots,
      detail: hasRobots ? "Existe robots.txt." : "No tiene robots.txt.",
    },
    {
      id: "sitemap",
      label: "Mapa del sitio (sitemap.xml)",
      ok: hasSitemap,
      detail: hasSitemap
        ? "Existe sitemap.xml."
        : "No encontramos sitemap.xml: a Google le cuesta más descubrir todas las páginas.",
    },
  ];
}
