import { NextResponse } from "next/server";
import { createDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 120;

async function run(days: number) {
  try {
    const digest = await createDigest(days);
    return NextResponse.json({ id: digest.id });
  } catch (error) {
    console.error("Falló el resumen:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: `No pudimos generar el resumen: ${message}` }, { status: 502 });
  }
}

/** Botón "Generar resumen" de la pantalla principal. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { days?: number };
  const days = Number.isInteger(body.days) && body.days! > 0 && body.days! <= 31 ? body.days! : 7;
  return run(days);
}

/**
 * Para automatizarlo: un cron llama a GET /api/digests?secret=TU_CRON_SECRET
 * una vez por semana (por ejemplo, los lunes a las 8).
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return run(7);
}
