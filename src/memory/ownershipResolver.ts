import { insertTeamOwnership, findTeamOwnership } from '../db/db';

export interface OwnershipResult {
  teamName: string;
  ownerHandle: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  evidenceExplanation: string;
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
      evidenceExplanation: `No CODEOWNERS record was found for repository '${repoName}'.`
    };
  }

  // Exact file pattern match
  if (filePath) {
    const normalizedFile = filePath.replace(/\\/g, '/').toLowerCase();
    for (const entry of ownershipEntries) {
      const pattern = entry.file_pattern.replace(/\\/g, '/').toLowerCase();
      if (pattern !== '*' && normalizedFile.includes(pattern)) {
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
