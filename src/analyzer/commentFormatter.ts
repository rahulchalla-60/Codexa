import { RiskAnalysisReport } from './riskEngine';

export function formatPRComment(report: RiskAnalysisReport): string {
  const badgeEmoji = report.riskLevel === 'HIGH' ? '🔴' : report.riskLevel === 'MEDIUM' ? '🟡' : '🟢';

  let markdown = `## ${badgeEmoji} Codexa Risk Report: ${report.riskLevel} RISK (Score: ${report.riskScore}/100)\n\n`;

  markdown += `### 🎯 Touched Symbols & API Contracts\n`;
  for (const entity of report.touchedEntities) {
    if (entity.endpointPath) {
      markdown += `- **Endpoint:** \`${entity.endpointMethod} ${entity.endpointPath}\` (Handled by \`${entity.symbolName}\` in \`${entity.repoName}\`)\n`;
    } else {
      markdown += `- **Function:** \`${entity.symbolName}\` in \`${entity.repoName}\` (\`${entity.filePath}:${entity.startLine}\`)\n`;
    }
  }

  // Resurface Historical Incident Memory
  if (report.matchedIncidents.length > 0) {
    markdown += `\n### 🚨 Institutional Memory: Historical Incidents Resurfaced (${report.matchedIncidents.length})\n`;
    markdown += `> ⚠️ **Warning:** Touched code paths in this PR have caused past production outages:\n`;
    for (const inc of report.matchedIncidents) {
      const target = inc.root_cause_endpoint ? `Endpoint \`${inc.root_cause_endpoint}\`` : `Symbol \`${inc.root_cause_symbol}\``;
      markdown += `- **Incident #${inc.id}: ${inc.title}** (${inc.occurred_at} | Severity: **${inc.severity}**)\n`;
      markdown += `  - *Root Cause Target:* ${target}\n`;
    }
  }

  markdown += `\n### 💥 Downstream Blast Radius (${report.impactedCallers.length} Affected Callers Across ${report.affectedRepos.length} Repositories)\n\n`;
  
  if (report.impactedCallers.length === 0) {
    markdown += `*No downstream caller functions are affected by this PR.*\n`;
  } else {
    const groupedByRepo = new Map<string, typeof report.impactedCallers>();
    for (const caller of report.impactedCallers) {
      if (!groupedByRepo.has(caller.source_repo)) {
        groupedByRepo.set(caller.source_repo, []);
      }
      groupedByRepo.get(caller.source_repo)!.push(caller);
    }

    groupedByRepo.forEach((callers, repo) => {
      markdown += `* **Repository: \`${repo}\`**\n`;
      for (const caller of callers) {
        markdown += `  - \`${caller.source_symbol_name}\` (Depth ${caller.depth})\n`;
      }
    });
  }

  markdown += `\n---\n`;
  if (report.riskLevel === 'HIGH') {
    markdown += `> ⚠️ **Action Required:** This Pull Request modifies code associated with past production outages or cross-repository API contracts. Verify test coverage and notify dependent service teams before merging!`;
  } else {
    markdown += `> ✅ **Safe to Merge:** Changes are isolated with minimal blast radius.`;
  }

  return markdown;
}
