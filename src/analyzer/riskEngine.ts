import { TouchedEntity } from './diffMapper';
import { findUpstreamCallers, findIncidentCorrelation } from '../db/db';
import { getOwnerTeam, OwnershipResult } from '../memory/ownershipResolver';
import { queryWhyCodeExists, KnowledgeNoteResult, getEntityTimeline, TimelineEvent } from '../memory/knowledgeEngine';

export interface ImpactedCaller {
  source_repo: string;
  source_symbol_name: string;
  source_signature: string;
  depth: number;
  weight: number;
}

export interface IncidentRecord {
  id: number;
  title: string;
  occurred_at: string;
  severity: string;
  root_cause_endpoint?: string;
  root_cause_symbol?: string;
}

export interface RiskAnalysisReport {
  touchedEntities: TouchedEntity[];
  impactedCallers: ImpactedCaller[];
  matchedIncidents: IncidentRecord[];
  ownerships: OwnershipResult[];
  knowledgeNotes: KnowledgeNoteResult[];
  timelines: TimelineEvent[];
  affectedRepos: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  isEndpointModified: boolean;
}

export function evaluatePRRisk(touchedEntities: TouchedEntity[]): RiskAnalysisReport {
  const allImpactedCallers: ImpactedCaller[] = [];
  const matchedIncidentsMap = new Map<number, IncidentRecord>();
  const ownerships: OwnershipResult[] = [];
  const knowledgeNotes: KnowledgeNoteResult[] = [];
  const timelines: TimelineEvent[] = [];

  let isEndpointModified = false;

  for (const entity of touchedEntities) {
    let contract: string | undefined;
    if (entity.endpointPath && entity.endpointMethod) {
      isEndpointModified = true;
      contract = `${entity.endpointMethod} ${entity.endpointPath}`;
    }

    const targetSig = entity.entitySignature;

    // Traverse recursive CTE graph using composite signature
    const rawCallers = findUpstreamCallers(targetSig) as any[];
    for (const caller of rawCallers) {
      const sigParts = caller.source_signature.split('::');
      const sourceRepo = sigParts[0] || entity.repoName;
      const sourceSymbol = sigParts.length >= 3 ? sigParts[2] : caller.source_signature;

      // Depth decay weighting: Depth 1 = 1.0, Depth 2 = 0.5, Depth 3+ = 0.2
      const weight = caller.depth === 1 ? 1.0 : caller.depth === 2 ? 0.5 : 0.2;

      allImpactedCallers.push({
        source_repo: sourceRepo,
        source_symbol_name: sourceSymbol,
        source_signature: caller.source_signature,
        depth: caller.depth,
        weight
      });
    }

    // Incident correlation search
    const incidents = findIncidentCorrelation(contract, entity.symbolName) as IncidentRecord[];
    for (const inc of incidents) {
      matchedIncidentsMap.set(inc.id, inc);
    }

    // CODEOWNERS ownership resolution
    const owner = getOwnerTeam(entity.symbolName, entity.repoName, entity.filePath);
    ownerships.push(owner);

    // Knowledge & Timeline resolution using composite signature
    const kNote = queryWhyCodeExists(targetSig);
    if (kNote.confidence !== 'LOW') {
      knowledgeNotes.push(kNote);
    }

    const history = getEntityTimeline(targetSig);
    timelines.push(...history);
  }

  // Deduplicate callers by composite signature
  const uniqueCallersMap = new Map<string, ImpactedCaller>();
  for (const caller of allImpactedCallers) {
    if (!uniqueCallersMap.has(caller.source_signature)) {
      uniqueCallersMap.set(caller.source_signature, caller);
    }
  }
  const uniqueCallers = Array.from(uniqueCallersMap.values());
  const matchedIncidents = Array.from(matchedIncidentsMap.values());

  // Extract unique impacted repos
  const affectedReposSet = new Set<string>();
  uniqueCallers.forEach(c => affectedReposSet.add(c.source_repo));
  const affectedRepos = Array.from(affectedReposSet);

  // Depth-Weighted Risk Scoring Algorithm
  let riskScore = 10;
  if (isEndpointModified) riskScore += 40;
  if (affectedRepos.length > 1) riskScore += 35;
  if (matchedIncidents.length > 0) riskScore += 30;

  // Add depth-weighted caller score
  const totalWeightedCallersScore = uniqueCallers.reduce((sum, c) => sum + (c.weight * 10), 0);
  riskScore += Math.min(totalWeightedCallersScore, 25);

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskScore >= 70) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 35) {
    riskLevel = 'MEDIUM';
  }

  return {
    touchedEntities,
    impactedCallers: uniqueCallers,
    matchedIncidents,
    ownerships,
    knowledgeNotes,
    timelines,
    affectedRepos,
    riskLevel,
    riskScore: Math.min(Math.round(riskScore), 100),
    isEndpointModified
  };
}
