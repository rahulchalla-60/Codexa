import Fastify from 'fastify';
import { mapDiffToEntities } from '../analyzer/diffMapper';
import { evaluatePRRisk } from '../analyzer/riskEngine';
import { formatPRComment } from '../analyzer/commentFormatter';
import { parseGitHubWebhookPayload, postGitHubPRComment } from '../services/githubService';
import { generateGroqAISummary } from '../services/llmService';

export function buildServer() {
  const fastify = Fastify({ logger: false });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'Codexa Engineering Memory Webhook Server' };
  });

  // GitHub Webhook listener endpoint
  fastify.post('/api/webhook', async (request, reply) => {
    const payload = request.body;
    console.log('\n========================================================');
    console.log('[Fastify Server]: Received GitHub Webhook Request');
    console.log('========================================================');

    // 1. Parse GitHub Webhook Event Payload
    const { action, repoName, repoOwner, prNumber, diffs } = parseGitHubWebhookPayload(payload);
    console.log(`[Webhook Event]: PR #${prNumber} (${action}) in '${repoOwner}/${repoName}'`);

    // 2. Map modified lines to AST entities
    const touchedEntities = mapDiffToEntities(diffs);

    // 3. Evaluate Risk Score & Incident Correlation
    const report = evaluatePRRisk(touchedEntities);

    // 4. Generate Groq AI Executive Summary (if GROQ_API_KEY present)
    const aiSummary = await generateGroqAISummary(report);

    // 5. Format PR Comment Markdown
    const commentMarkdown = formatPRComment(report, aiSummary);

    // 6. Post comment to GitHub API / Dry-run
    const success = await postGitHubPRComment(
      repoOwner,
      repoName,
      prNumber,
      commentMarkdown,
      process.env.GITHUB_TOKEN
    );

    return reply.status(200).send({
      success,
      prNumber,
      riskLevel: report.riskLevel,
      riskScore: report.riskScore,
      impactedCallersCount: report.impactedCallers.length,
      matchedIncidentsCount: report.matchedIncidents.length,
      aiSummaryActive: !!aiSummary,
      commentMarkdown
    });
  });

  return fastify;
}
