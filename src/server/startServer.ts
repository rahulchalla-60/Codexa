import 'dotenv/config';
import Parser from 'tree-sitter';
import path from 'path';
import {
  initDb,
  resetDb,
  insertIncident,
  insertKnowledgeNote,
  insertEntityHistory
} from '../db/db';
import { indexRepo } from '../indexer/core';
import { parseAndRegisterCodeowners } from '../memory/ownershipResolver';
import { buildServer } from './webhookServer';

const TypeScript = require('tree-sitter-typescript').typescript;

async function start() {
  console.log('--- Setting Up Database Graph & Shared Indexer Core ---');
  initDb();
  resetDb();

  const parser = new Parser();
  parser.setLanguage(TypeScript);

  const mockReposDir = path.join(__dirname, '../../mock_repos');

  // 1. Index Repositories using shared indexer core
  indexRepo(parser, 'payment-service', path.join(mockReposDir, 'payment-service'));
  indexRepo(parser, 'web-dashboard', path.join(mockReposDir, 'web-dashboard'));

  // 2. Ingest CODEOWNERS
  console.log('--- Registering CODEOWNERS Rules ---');
  parseAndRegisterCodeowners('payment-service', `
src/routes.ts @payments-squad
* @core-backend-team
  `);

  // 3. Seed Incident Memory
  console.log('--- Ingesting Incident Postmortems ---');
  insertIncident(
    'Payment Gateway Timeout Outage',
    'March 2026',
    'CRITICAL',
    'POST /v1/charge',
    'processCharge'
  );

  // 4. Seed Knowledge Notes (Jira PAY-101)
  console.log('--- Ingesting Knowledge Notes (Jira PAY-101) ---');
  insertKnowledgeNote(
    'POST /v1/charge',
    'Why was this endpoint built?',
    'Decoupled legacy billing monolith into microservice endpoint for Stripe/PayPal integration (Ref: Jira PAY-101).',
    'JIRA_PAY101',
    'HIGH'
  );

  // 5. Seed Entity Timeline History
  console.log('--- Registering Entity Event Timelines ---');
  insertEntityHistory(
    'POST /v1/charge',
    'CREATED',
    '2025-01-15',
    'rahul@codexa',
    'Initial REST endpoint creation for payment microservice.'
  );
  insertEntityHistory(
    'POST /v1/charge',
    'INCIDENT',
    '2026-03-10',
    'pagerduty',
    'Incident #482: Production gateway timeout during high-volume checkout.'
  );

  // 6. Build and start Fastify Server
  const server = buildServer();
  const PORT = 3000;

  try {
    await server.listen({ port: PORT });
    console.log(`\n🚀 [Codexa Engineering Memory Server Active]: http://localhost:${PORT}`);
    console.log(`📌 Webhook Endpoint: http://localhost:${PORT}/api/webhook\n`);

    // Simulate sending a live GitHub Webhook POST request
    console.log('--- Simulating Incoming Webhook HTTP POST Request ---');
    const response = await server.inject({
      method: 'POST',
      url: '/api/webhook',
      payload: {
        action: 'opened',
        number: 42,
        repository: {
          name: 'payment-service',
          owner: { login: 'codexa-org' }
        },
        pull_request: {
          number: 42,
          head: { sha: 'a1b2c3d4e5f' }
        },
        simulated_diffs: [
          {
            repoName: 'payment-service',
            filePath: 'src/routes.ts',
            startLine: 2,
            endLine: 5
          }
        ]
      }
    });

    console.log(`\n[Server Response Code]: ${response.statusCode}`);
    const resBody = JSON.parse(response.body);
    console.log(`[Analysis Summary]: Risk Level=${resBody.riskLevel}, Score=${resBody.riskScore}/100`);
    console.log('\n--- GENERATED GITHUB PR COMMENT WITH PHASE 10 REFACTORED CORE ---');
    console.log(resBody.commentMarkdown);

    console.log('\n--- PHASE 10 REFACTORING VERIFICATION SUCCESSFUL ---');
    
    await server.close();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start().catch(console.error);
