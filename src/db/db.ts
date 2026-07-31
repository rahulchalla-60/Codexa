import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../codexa_graph.db');
export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_symbol_name TEXT NOT NULL,
      target_symbol_name TEXT NOT NULL,
      type TEXT NOT NULL
    );
  `);
}

export function resetDb() {
  db.exec(`
    DELETE FROM symbols;
    DELETE FROM edges;
  `);
}

export function insertSymbol(name: string, filePath: string, kind: string, startLine: number, endLine: number) {
  const stmt = db.prepare(`
    INSERT INTO symbols (name, file_path, kind, start_line, end_line)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(name, filePath, kind, startLine, endLine);
}

export function insertEdge(sourceSymbolName: string, targetSymbolName: string, type: string = 'calls') {
  const stmt = db.prepare(`
    INSERT INTO edges (source_symbol_name, target_symbol_name, type)
    VALUES (?, ?, ?)
  `);
  stmt.run(sourceSymbolName, targetSymbolName, type);
}

export function findUpstreamCallers(targetName: string) {
  const stmt = db.prepare(`
    WITH RECURSIVE CallChain AS (
      SELECT source_symbol_name, target_symbol_name, 1 as depth
      FROM edges
      WHERE target_symbol_name = ?
      
      UNION ALL
      
      SELECT e.source_symbol_name, e.target_symbol_name, cc.depth + 1
      FROM edges e
      INNER JOIN CallChain cc ON e.target_symbol_name = cc.source_symbol_name
      WHERE cc.depth < 10
    )
    SELECT DISTINCT source_symbol_name, depth FROM CallChain;
  `);
  return stmt.all(targetName);
}
