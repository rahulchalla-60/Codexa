import { db } from '../db/db';

export interface DiffLocation {
  repoName: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface TouchedEntity {
  repoName: string;
  symbolName: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  endpointPath?: string;
  endpointMethod?: string;
}

export function mapDiffToEntities(diffs: DiffLocation[]): TouchedEntity[] {
  const touchedEntities: TouchedEntity[] = [];

  for (const diff of diffs) {
    // Fetch symbols for this repo
    const stmt = db.prepare(`
      SELECT repo_name, name, file_path, kind, start_line, end_line
      FROM symbols
      WHERE repo_name = ?
    `);

    const symbols = stmt.all(diff.repoName) as any[];

    // Normalize slashes for Windows compatibility
    const targetFileNormalized = diff.filePath.replace(/\\/g, '/').toLowerCase();

    for (const sym of symbols) {
      const symFileNormalized = sym.file_path.replace(/\\/g, '/').toLowerCase();

      // Check if file matches AND line ranges intersect
      if (symFileNormalized.includes(targetFileNormalized)) {
        if (diff.startLine <= sym.end_line && diff.endLine >= sym.start_line) {
          // Check if this symbol handles an endpoint contract
          const epStmt = db.prepare(`
            SELECT method, path FROM endpoints
            WHERE repo_name = ? AND handler_symbol_name = ?
          `);
          const endpoint = epStmt.get(sym.repo_name, sym.name) as any;

          touchedEntities.push({
            repoName: sym.repo_name,
            symbolName: sym.name,
            kind: sym.kind,
            filePath: sym.file_path,
            startLine: sym.start_line,
            endLine: sym.end_line,
            endpointPath: endpoint ? endpoint.path : undefined,
            endpointMethod: endpoint ? endpoint.method : undefined
          });
        }
      }
    }
  }

  return touchedEntities;
}
