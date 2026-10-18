import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { ReportData, ReportRow } from "./types";

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
    )
  `);
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
