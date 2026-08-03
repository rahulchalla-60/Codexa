import fs from 'fs';
import path from 'path';
import { insertTeamOwnership, findTeamOwnership } from '../db/db';

export interface OwnershipResult {
  teamName: string;
  ownerHandle: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  evidenceExplanation: string;
}

export function ingestRepoCodeowners(repoName: string, repoDir: string) {
  const possiblePaths = [
    path.join(repoDir, '.github', 'CODEOWNERS'),
    path.join(repoDir, 'CODEOWNERS'),
    path.join(repoDir, 'docs', 'CODEOWNERS')
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        console.log(`  └─ Ingested disk CODEOWNERS at: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        parseAndRegisterCodeowners(repoName, content);
        return;
      } catch (err: any) {
        console.warn(`[CODEOWNERS Warning]: Failed to read ${filePath}: ${err.message}`);
      }
    }
  }
  console.log(`  └─ No CODEOWNERS file found on disk for repository '${repoName}'`);
}

export function parseAndRegisterCodeowners(repoName: string, codeownersContent: string) {
  const lines = codeownersContent.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const filePattern = parts[0];
      const ownerHandle = parts[1];
      const teamName = ownerHandle.replace(/^@/, '').replace(/[-_]/g, ' ').toUpperCase();

      insertTeamOwnership(repoName, filePattern, teamName, ownerHandle, 'CODEOWNERS', 'HIGH');
    }
  }
}

export function getOwnerTeam(symbolName: string, repoName: string, filePath?: string): OwnershipResult {
  const ownershipEntries = findTeamOwnership(repoName) as any[];

  if (ownershipEntries.length === 0) {
    return {
      teamName: 'UNASSIGNED',
      ownerHandle: '@unassigned',
      confidence: 'LOW',
      source: 'NO_CODEOWNERS_FILE',
      evidenceExplanation: `No CODEOWNERS file exists on disk for repository '${repoName}'.`
    };
  }

  // File pattern matching with glob support
  if (filePath) {
    const normalizedFile = filePath.replace(/\\/g, '/').toLowerCase();
    
    for (const entry of ownershipEntries) {
      const pattern = entry.file_pattern.replace(/\\/g, '/').toLowerCase();
      
      if (pattern !== '*') {
        // Convert glob pattern (e.g. src/routes.ts or src/payment/*.ts) to Regex
        const cleanPattern = pattern.replace(/^\//, '');
        const regexPattern = new RegExp(
          cleanPattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*'),
          'i'
        );

        if (regexPattern.test(normalizedFile) || normalizedFile.includes(cleanPattern.replace(/\.\*/g, '').replace(/\*/g, ''))) {
          return {
            teamName: entry.team_name,
            ownerHandle: entry.owner_handle,
            confidence: 'HIGH',
            source: entry.source,
            evidenceExplanation: `Matched specific file rule '${entry.file_pattern}' in repository '${repoName}'.`
          };
        }
      }
    }
  }

  // Default wildcard match (*)
  const wildcardEntry = ownershipEntries.find(e => e.file_pattern === '*');
  if (wildcardEntry) {
    return {
      teamName: wildcardEntry.team_name,
      ownerHandle: wildcardEntry.owner_handle,
      confidence: 'MEDIUM',
      source: wildcardEntry.source,
      evidenceExplanation: `Matched repository-level default wildcard rule '*' in CODEOWNERS.`
    };
  }

  return {
    teamName: 'ENGINEERING',
    ownerHandle: '@engineering-team',
    confidence: 'LOW',
    source: 'FALLBACK',
    evidenceExplanation: `Derived fallback ownership for symbol '${symbolName}'.`
  };
}
