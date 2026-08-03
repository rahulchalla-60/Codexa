import Groq from 'groq-sdk';
import { RiskAnalysisReport } from '../analyzer/riskEngine';

export async function generateGroqAISummary(report: RiskAnalysisReport): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key')) {
    console.log('[Groq AI Service (Fallback Mode)]: GROQ_API_KEY not found in .env. Skipping LLM generation and using deterministic markdown.');
    return null;
  }

  try {
    const groq = new Groq({ apiKey });
    console.log('[Groq AI Service]: Generating AI Executive Summary via Groq API (llama-3.3-70b-versatile)...');

    const promptPayload = {
      riskLevel: report.riskLevel,
      riskScore: report.riskScore,
      isEndpointModified: report.isEndpointModified,
      touchedEntities: report.touchedEntities.map(e => ({
        symbol: e.symbolName,
        signature: e.entitySignature,
        repo: e.repoName,
        endpoint: e.endpointPath ? `${e.endpointMethod} ${e.endpointPath}` : null
      })),
      impactedCallersCount: report.impactedCallers.length,
      affectedRepos: report.affectedRepos,
      matchedIncidents: report.matchedIncidents.map(i => ({ title: i.title, severity: i.severity, date: i.occurred_at })),
      ownerships: report.ownerships.map(o => ({ owner: o.ownerHandle, team: o.teamName }))
    };

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert DevOps and Code Security AI Engineer for Codexa. Summarize the provided PR risk JSON payload into a 2-3 sentence clear, professional executive warning for developers reviewing a GitHub Pull Request. Be concise and actionable.'
        },
        {
          role: 'user',
          content: `Analyze this PR Risk Report JSON:\n${JSON.stringify(promptPayload, null, 2)}`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_completion_tokens: 250
    });

    const aiSummary = completion.choices[0]?.message?.content?.trim() || null;
    if (aiSummary) {
      console.log('[Groq AI Service]: Successfully generated AI summary!');
    }
    return aiSummary;
  } catch (err: any) {
    console.warn(`[Groq AI Warning]: Failed to generate summary: ${err.message}. Falling back to deterministic mode.`);
    return null;
  }
}
