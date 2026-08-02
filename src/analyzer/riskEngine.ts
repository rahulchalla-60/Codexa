import { TouchedEntity } from './diffMapper';
import { findUpstreamCallers, findIncidentCorrelation } from '../db/db';

export interface ImpactedCaller {
  source_repo: string;
  source_symbol_name: string;
  depth: number;
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
  affectedRepos: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  isEndpointModified: boolean;
}

export function evaluatePRRisk(touchedEntities: TouchedEntity[]): RiskAnalysisReport {
  const allImpactedCallers: ImpactedCaller[] = [];
  const matchedIncidentsMap = new Map<number, IncidentRecord>();
  let isEndpointModified = false;

  for (const entity of touchedEntities) {
    let contract: string | undefined;
    if (entity.endpointPath && entity.endpointMethod) {
      isEndpointModified = true;
      contract = `${entity.endpointMethod} ${entity.endpointPath}`;
      const callers = findUpstreamCallers(contract) as ImpactedCaller[];
      allImpactedCallers.push(...callers);
    } else {
      const callers = findUpstreamCallers(entity.symbolName, entity.repoName) as ImpactedCaller[];
      allImpactedCallers.push(...callers);
    }

    // Incident correlation search
    const incidents = findIncidentCorrelation(contract, entity.symbolName) as IncidentRecord[];
    for (const inc of incidents) {
      matchedIncidentsMap.set(inc.id, inc);
    }
  }

  // Deduplicate callers
  const uniqueCallersMap = new Map<string, ImpactedCaller>();
  for (const caller of allImpactedCallers) {
    const key = `${caller.source_repo}:${caller.source_symbol_name}`;
    if (!uniqueCallersMap.has(key)) {
      uniqueCallersMap.set(key, caller);
    }
  }
  const uniqueCallers = Array.from(uniqueCallersMap.values());
  const matchedIncidents = Array.from(matchedIncidentsMap.values());

  // Extract unique impacted repos
  const affectedReposSet = new Set<string>();
  uniqueCallers.forEach(c => affectedReposSet.add(c.source_repo));
  const affectedRepos = Array.from(affectedReposSet);

  // Risk Scoring Algorithm
  let riskScore = 10;
  if (isEndpointModified) riskScore += 40;
  if (affectedRepos.length > 1) riskScore += 35;
  if (matchedIncidents.length > 0) riskScore += 30; // Historical incident memory penalty

  riskScore += Math.min(uniqueCallers.length * 5, 15);

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
    affectedRepos,
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    isEndpointModified
  };
}
