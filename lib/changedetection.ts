// Cliente de changedetection.io (github.com/dgtlmoon/changedetection.io).
// changedetection hace el trabajo pesado: visita las páginas cada cierto
// tiempo y guarda una copia cada vez que cambian. Nosotros le pedimos las
// diferencias y se las pasamos a la IA.

import type { DiffItem } from "./types";

export function hasChangedetection() {
  return Boolean(process.env.CHANGEDETECTION_URL);
}

function baseUrl() {
  return (process.env.CHANGEDETECTION_URL ?? "").replace(/\/+$/, "");
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CHANGEDETECTION_API_KEY ?? "",
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 403) {
    throw new Error("changedetection rechazó la clave: revisá CHANGEDETECTION_API_KEY (Settings → API en changedetection).");
  }
  if (!response.ok) {
    throw new Error(`changedetection respondió ${response.status} en ${path}: ${(await response.text()).slice(0, 200)}`);
  }
  return response;
}

/** Empieza a vigilar una página. Devuelve el id (uuid) que le asigna changedetection. */
export async function createWatch(url: string, title: string, tag: string): Promise<string> {
  const notificationUrls = (process.env.CHANGEDETECTION_NOTIFICATION_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const response = await call("/api/v1/watch", {
    method: "POST",
    body: JSON.stringify({
      url,
      title,
      tag,
      ...(notificationUrls.length ? { notification_urls: notificationUrls } : {}),
    }),
  });
  const json = (await response.json()) as { uuid: string };
  return json.uuid;
}

export async function deleteWatch(uuid: string) {
  await call(`/api/v1/watch/${uuid}`, { method: "DELETE" });
}

/** Pide revisar todas las páginas ahora, sin esperar al próximo turno. */
export async function recheckAll() {
  await call("/api/v1/watch?recheck_all=1");
}

/** Momentos (segundos Unix, ordenados) en que se guardó una copia de la página. */
export async function getSnapshotTimes(uuid: string): Promise<string[]> {
  const response = await call(`/api/v1/watch/${uuid}/history`);
  const history = (await response.json()) as Record<string, string>;
  return Object.keys(history).sort((a, b) => Number(a) - Number(b));
}

export async function getDiff(uuid: string, from: string, to: string): Promise<DiffItem[]> {
  const response = await call(`/api/v1/watch/${uuid}/difference/${from}/${to}?changesOnly=true&format=text`);
  return parseDiff(await response.text());
}

/**
 * changedetection devuelve líneas marcadas así:
 *   (changed) texto viejo
 *   (into) texto nuevo
 *   (added) texto agregado
 *   (removed) texto borrado
 */
export function parseDiff(text: string): DiffItem[] {
  const items: DiffItem[] = [];
  let pendingBefore: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const match = /^\((changed|into|added|removed)\)\s?(.*)$/.exec(rawLine);
    if (!match) continue;
    const [, kind, rest] = match;
    const line = rest.replace(/^\s*[*•-]\s*/, "").trim();
    if (!line) continue;
    if (kind === "changed") pendingBefore.push(line);
    else if (kind === "into") {
      items.push({ type: "changed", before: pendingBefore.shift() ?? "", after: line });
    } else items.push({ type: kind as "added" | "removed", text: line });
  }
  // "changed" sin su "into" correspondiente: lo tratamos como borrado.
  for (const before of pendingBefore) items.push({ type: "removed", text: before });
  return items;
}
