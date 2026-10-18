import { NextResponse } from "next/server";
import { deleteWatch } from "@/lib/changedetection";
import { deleteCompetitor, listCompetitors } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const competitor = listCompetitors().find((c) => c.id === Number(id));
  if (!competitor) return NextResponse.json({ error: "No existe ese competidor" }, { status: 404 });

  // Si changedetection no responde, igual lo borramos de nuestra lista.
  await Promise.allSettled(competitor.pages.filter((p) => p.watchUuid).map((p) => deleteWatch(p.watchUuid!)));
  deleteCompetitor(competitor.id);
  return NextResponse.json({ ok: true });
}
