import { NextResponse } from "next/server";
import { hasChangedetection, recheckAll } from "@/lib/changedetection";

export const runtime = "nodejs";

export async function POST() {
  if (!hasChangedetection()) return NextResponse.json({ ok: true, demo: true });
  try {
    await recheckAll();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
