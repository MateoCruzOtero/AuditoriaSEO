import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeProspect } from "@/lib/analyze";
import { findCountry } from "@/lib/countries";
import { saveReport } from "@/lib/db";
import { normalizeDomain } from "@/lib/domain";

export const runtime = "nodejs";
// El análisis puede tardar ~1 minuto (DataForSEO + IA).
export const maxDuration = 120;

const RequestSchema = z.object({
  domain: z.string().trim().min(1, "Ingresá el dominio del prospecto"),
  businessName: z.string().trim().max(120).optional(),
  competitors: z.array(z.string().trim()).max(3).optional(),
  locationCode: z.number().int(),
  offer: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }
  const body = parsed.data;

  const domain = normalizeDomain(body.domain);
  if (!domain) {
    return NextResponse.json({ error: "El dominio no es válido. Ejemplo: minegocio.com" }, { status: 400 });
  }
  const country = findCountry(body.locationCode);
  if (!country) {
    return NextResponse.json({ error: "Elegí un país de la lista" }, { status: 400 });
  }

  const competitors: string[] = [];
  for (const raw of body.competitors ?? []) {
    if (!raw) continue;
    const competitor = normalizeDomain(raw);
    if (!competitor) {
      return NextResponse.json({ error: `El competidor "${raw}" no es un dominio válido` }, { status: 400 });
    }
    if (competitor !== domain && !competitors.includes(competitor)) competitors.push(competitor);
  }

  const id = randomUUID();
  const base = {
    id,
    createdAt: new Date().toISOString(),
    domain,
    businessName: body.businessName || null,
    locationCode: country.code,
  };

  try {
    const data = await analyzeProspect({
      domain,
      businessName: base.businessName,
      competitors,
      market: { locationCode: country.code, languageCode: country.language },
      countryLabel: country.label,
      offer: body.offer || "posicionamiento en Google (SEO)",
    });
    saveReport({ ...base, status: "ok", error: null, data });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Falló el análisis:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: `No pudimos generar el informe: ${message}` }, { status: 502 });
  }
}
