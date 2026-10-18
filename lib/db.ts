import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Competitor, Digest, ReportData, ReportRow, WatchedPage } from "./types";

// Base de datos local en un archivo. Para producción con varios usuarios
// conviene pasar a Postgres, pero para el MVP alcanza y sobra.
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "prospector.db");

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      domain TEXT NOT NULL,
      business_name TEXT,
      location_code INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watched_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      watch_uuid TEXT
    );
    CREATE TABLE IF NOT EXISTS digests (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  db.pragma("foreign_keys = ON");
  return db;
}

type DbRow = {
  id: string;
  created_at: string;
  domain: string;
  business_name: string | null;
  location_code: number;
  status: "ok" | "error";
  error: string | null;
  data: string | null;
};

function toReport(row: DbRow): ReportRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    domain: row.domain,
    businessName: row.business_name,
    locationCode: row.location_code,
    status: row.status,
    error: row.error,
    data: row.data ? (JSON.parse(row.data) as ReportData) : null,
  };
}

export function saveReport(report: ReportRow) {
  getDb()
    .prepare(
      `INSERT INTO reports (id, created_at, domain, business_name, location_code, status, error, data)
       VALUES (@id, @createdAt, @domain, @businessName, @locationCode, @status, @error, @data)`,
    )
    .run({ ...report, data: report.data ? JSON.stringify(report.data) : null });
}

export function getReport(id: string): ReportRow | null {
  const row = getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id) as DbRow | undefined;
  return row ? toReport(row) : null;
}

export function listReports(limit = 50): ReportRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT ?")
    .all(limit) as DbRow[];
  return rows.map(toReport);
}

export function deleteReport(id: string) {
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Vigilancia de la competencia
// ---------------------------------------------------------------------------

export function addCompetitor(
  name: string,
  website: string,
  pages: { label: string; url: string; watchUuid: string | null }[],
): number {
  const database = getDb();
  const insert = database.transaction(() => {
    const { lastInsertRowid } = database
      .prepare("INSERT INTO competitors (name, website, created_at) VALUES (?, ?, ?)")
      .run(name, website, new Date().toISOString());
    const competitorId = Number(lastInsertRowid);
    const insertPage = database.prepare(
      "INSERT INTO watched_pages (competitor_id, label, url, watch_uuid) VALUES (?, ?, ?, ?)",
    );
    for (const page of pages) insertPage.run(competitorId, page.label, page.url, page.watchUuid);
    return competitorId;
  });
  return insert();
}

export function listCompetitors(): Competitor[] {
  const database = getDb();
  const competitors = database.prepare("SELECT * FROM competitors ORDER BY name").all() as {
    id: number;
    name: string;
    website: string;
    created_at: string;
  }[];
  const pages = database.prepare("SELECT * FROM watched_pages ORDER BY id").all() as {
    id: number;
    competitor_id: number;
    label: string;
    url: string;
    watch_uuid: string | null;
  }[];
  return competitors.map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    createdAt: c.created_at,
    pages: pages
      .filter((p) => p.competitor_id === c.id)
      .map(
        (p): WatchedPage => ({
          id: p.id,
          competitorId: p.competitor_id,
          label: p.label,
          url: p.url,
          watchUuid: p.watch_uuid,
        }),
      ),
  }));
}

export function deleteCompetitor(id: number) {
  getDb().prepare("DELETE FROM competitors WHERE id = ?").run(id);
}

export function saveDigest(digest: Digest) {
  getDb()
    .prepare("INSERT INTO digests (id, created_at, data) VALUES (?, ?, ?)")
    .run(digest.id, digest.createdAt, JSON.stringify(digest));
}

export function getDigest(id: string): Digest | null {
  const row = getDb().prepare("SELECT data FROM digests WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Digest) : null;
}

export function listDigests(limit = 20): Digest[] {
  const rows = getDb()
    .prepare("SELECT data FROM digests ORDER BY created_at DESC LIMIT ?")
    .all(limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as Digest);
}
