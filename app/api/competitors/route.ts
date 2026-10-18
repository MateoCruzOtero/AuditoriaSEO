import { NextResponse } from "next/server";
import { z } from "zod";
import { createWatch, deleteWatch, hasChangedetection } from "@/lib/changedetection";
import { addCompetitor } from "@/lib/db";
import { normalizeDomain } from "@/lib/domain";

export const runtime = "nodejs";

const RequestSchema = z.object({
  name: z.string().trim().min(1, "Poné el nombre del competidor").max(80),
  website: z.string().trim().min(1, "Poné el sitio web del competidor"),
  pages: z
    .array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().trim().min(1) }))
    .min(1, "Agregá al menos una página para vigilar")
    .max(8),
});

/** Acepta "https://sitio.com/precios" o solo "/precios" (se completa con el dominio). */
function resolvePageUrl(raw: string, domain: string): string | null {
  const candidate = raw.startsWith("/") ? `https://${domain}${raw}` : raw.includes("://") ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }
  const { name, website, pages } = parsed.data;
  const domain = normalizeDomain(website);
  if (!domain) return NextResponse.json({ error: "El sitio web no es válido" }, { status: 400 });

  const resolved: { label: string; url: string }[] = [];
  for (const page of pages) {
    const url = resolvePageUrl(page.url, domain);
    if (!url) return NextResponse.json({ error: `La dirección "${page.url}" no es válida` }, { status: 400 });
    resolved.push({ label: page.label, url });
  }

  // Damos de alta cada página en changedetection. Si una falla, deshacemos las anteriores.
  const created: { label: string; url: string; watchUuid: string | null }[] = [];
  try {
    for (const page of resolved) {
      const watchUuid = hasChangedetection() ? await createWatch(page.url, `${name} · ${page.label}`, name) : null;
      created.push({ ...page, watchUuid });
    }
  } catch (error) {
    await Promise.allSettled(created.filter((p) => p.watchUuid).map((p) => deleteWatch(p.watchUuid!)));
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: `No pudimos empezar a vigilar: ${message}` }, { status: 502 });
  }

  const id = addCompetitor(name, domain, created);
  return NextResponse.json({ id });
}
