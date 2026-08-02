import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../codexa_graph.db');
export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      root_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      handler_symbol_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_repo TEXT NOT NULL,
      source_symbol_name TEXT NOT NULL,
      target_repo TEXT NOT NULL,
      target_symbol_name TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      severity TEXT NOT NULL,
      root_cause_endpoint TEXT,
      root_cause_symbol TEXT
    );
  `);
}

export function resetDb() {
  db.exec(`
    DROP TABLE IF EXISTS symbols;
    DROP TABLE IF EXISTS edges;
    DROP TABLE IF EXISTS endpoints;
    DROP TABLE IF EXISTS repos;
    DROP TABLE IF EXISTS incidents;
  `);
  initDb();
}

export function insertRepo(name: string, rootPath: string) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO repos (name, root_path) VALUES (?, ?)
  `);
  stmt.run(name, rootPath);
}

export function insertSymbol(repoName: string, name: string, filePath: string, kind: string, startLine: number, endLine: number) {
  const stmt = db.prepare(`
    INSERT INTO symbols (repo_name, name, file_path, kind, start_line, end_line)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(repoName, name, filePath, kind, startLine, endLine);
}

export function insertEndpoint(repoName: string, method: string, routePath: string, handlerSymbolName: string) {
  const stmt = db.prepare(`
    INSERT INTO endpoints (repo_name, method, path, handler_symbol_name)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(repoName, method.toUpperCase(), routePath, handlerSymbolName);
}

export function insertEdge(
  sourceRepo: string,
  sourceSymbolName: string,
  targetRepo: string,
  targetSymbolName: string,
  type: string = 'calls'
) {
  const stmt = db.prepare(`
    INSERT INTO edges (source_repo, source_symbol_name, target_repo, target_symbol_name, type)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(sourceRepo, sourceSymbolName, targetRepo, targetSymbolName, type);
}

export function insertIncident(
  title: string,
  occurredAt: string,
  severity: string,
  rootCauseEndpoint?: string,
  rootCauseSymbol?: string
) {
  const stmt = db.prepare(`
    INSERT INTO incidents (title, occurred_at, severity, root_cause_endpoint, root_cause_symbol)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(title, occurredAt, severity, rootCauseEndpoint || null, rootCauseSymbol || null);
}

export function findUpstreamCallers(targetSymbolName: string, targetRepo: string = 'all') {
  const stmt = db.prepare(`
    WITH RECURSIVE CallChain AS (
      SELECT source_repo, source_symbol_name, target_repo, target_symbol_name, 1 as depth
      FROM edges
      WHERE target_symbol_name = ?
        AND (? = 'all' OR target_repo = ?)
      
      UNION ALL
      
      SELECT e.source_repo, e.source_symbol_name, e.target_repo, e.target_symbol_name, cc.depth + 1
      FROM edges e
      INNER JOIN CallChain cc 
        ON e.target_symbol_name = cc.source_symbol_name
       AND e.target_repo = cc.source_repo
      WHERE cc.depth < 10
    )
    SELECT DISTINCT source_repo, source_symbol_name, depth FROM CallChain;
  `);
  return stmt.all(targetSymbolName, targetRepo, targetRepo);
}

export function findIncidentCorrelation(endpointContract?: string, symbolName?: string) {
  const stmt = db.prepare(`
    SELECT id, title, occurred_at, severity, root_cause_endpoint, root_cause_symbol
    FROM incidents
    WHERE (? IS NOT NULL AND root_cause_endpoint = ?)
       OR (? IS NOT NULL AND root_cause_symbol = ?)
  `);
  return stmt.all(
    endpointContract || null,
    endpointContract || null,
    symbolName || null,
    symbolName || null
  );
}
