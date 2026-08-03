import { RiskAnalysisReport } from './riskEngine';

export function formatPRComment(report: RiskAnalysisReport): string {
  const badgeEmoji = report.riskLevel === 'HIGH' ? '🔴' : report.riskLevel === 'MEDIUM' ? '🟡' : '🟢';

  let markdown = `## ${badgeEmoji} Codexa Risk & Memory Report: ${report.riskLevel} RISK (Score: ${report.riskScore}/100)\n\n`;

  markdown += `### 🎯 Touched Symbols & API Contracts\n`;
  for (const entity of report.touchedEntities) {
    if (entity.endpointPath) {
      markdown += `- **Endpoint:** \`${entity.endpointMethod} ${entity.endpointPath}\` (Handled by \`${entity.symbolName}\` in \`${entity.repoName}\`)\n`;
    } else {
      markdown += `- **Function:** \`${entity.symbolName}\` in \`${entity.repoName}\` (\`${entity.filePath}:${entity.startLine}\`)\n`;
    }
  }

  // CODEOWNERS Team Ownership
  if (report.ownerships.length > 0) {
    markdown += `\n### 👥 Team Ownership & Escalation Contacts\n`;
    for (const owner of report.ownerships) {
      markdown += `- **Owner:** \`${owner.ownerHandle}\` (${owner.teamName}) | Confidence: **${owner.confidence}** (*${owner.evidenceExplanation}*)\n`;
    }
  }

  // Institutional Knowledge Notes (Why Code Exists)
  if (report.knowledgeNotes.length > 0) {
    markdown += `\n### 💡 Institutional Memory: Why This Code Exists\n`;
    for (const note of report.knowledgeNotes) {
      markdown += `- **Q:** *${note.question}*\n`;
      markdown += `  - **A:** ${note.answer} (Source: \`${note.source}\` | Confidence: **${note.confidence}**)\n`;
    }
  }

  // Historical Incidents Resurfaced
  if (report.matchedIncidents.length > 0) {
    markdown += `\n### 🚨 Historical Incidents Resurfaced (${report.matchedIncidents.length})\n`;
    markdown += `> ⚠️ **Warning:** Touched code paths in this PR have caused past production outages:\n`;
    for (const inc of report.matchedIncidents) {
      const target = inc.root_cause_endpoint ? `Endpoint \`${inc.root_cause_endpoint}\`` : `Symbol \`${inc.root_cause_symbol}\``;
      markdown += `- **Incident #${inc.id}: ${inc.title}** (${inc.occurred_at} | Severity: **${inc.severity}**)\n`;
      markdown += `  - *Root Cause Target:* ${target}\n`;
    }
  }

  // Chronological Entity History Timeline
  if (report.timelines.length > 0) {
    markdown += `\n### 📜 Entity Event History Timeline (${report.timelines.length})\n`;
    for (const event of report.timelines) {
      markdown += `- \`[${event.timestamp}]\` **${event.eventType}** by *${event.actor}*: ${event.description}\n`;
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
    const mainOwner = report.ownerships[0]?.ownerHandle || 'responsible team';
    markdown += `> ⚠️ **Action Required:** This Pull Request modifies high-risk cross-repository contracts or past outage code. Please request review from ${mainOwner} before merging!`;
  } else {
    markdown += `> ✅ **Safe to Merge:** Changes are isolated with minimal blast radius.`;
  }

  return markdown;
}
