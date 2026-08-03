import Parser from 'tree-sitter';
import path from 'path';
import {
  initDb,
  resetDb,
  insertIncident
} from './db/db';
import { indexRepo } from './indexer/core';
import { mapDiffToEntities } from './analyzer/diffMapper';
import { evaluatePRRisk } from './analyzer/riskEngine';
import { formatPRComment } from './analyzer/commentFormatter';

const TypeScript = require('tree-sitter-typescript').typescript;

async function main() {
  initDb();
  resetDb();

  const parser = new Parser();
  parser.setLanguage(TypeScript);

  const mockReposDir = path.join(__dirname, '../mock_repos');

  console.log('========================================================');
  console.log('--- 1. Multi-Repo Directory Indexing & AST Analysis ---');
  console.log('========================================================\n');

  // Register and index payment-service (Backend)
  const backendRepoPath = path.join(mockReposDir, 'payment-service');
  indexRepo(parser, 'payment-service', backendRepoPath);

  // Register and index web-dashboard (Frontend)
  const frontendRepoPath = path.join(mockReposDir, 'web-dashboard');
  indexRepo(parser, 'web-dashboard', frontendRepoPath);

  console.log('\n========================================================');
  console.log('--- 2. Ingesting Historical Incident Memory (PagerDuty) ---');
  console.log('========================================================\n');

  console.log('Ingesting Incident #482: "Payment Gateway Timeout Outage" (March 2026) -> Root cause: POST /v1/charge');
  insertIncident(
    'Payment Gateway Timeout Outage',
    'March 2026',
    'CRITICAL',
    'POST /v1/charge',
    'processCharge'
  );

  console.log('\n========================================================');
  console.log('--- 3. Phase 10 Refactored Core Indexer PR Risk Analysis ---');
  console.log('========================================================\n');

  console.log('Simulating PR #42 in "payment-service": Editing "routes.ts" (Lines 2-5)...\n');

  const simulatedDiff = [
    {
      repoName: 'payment-service',
      filePath: 'src/routes.ts',
      startLine: 2,
      endLine: 5
    }
  ];

  // 1. Map diff to DB symbols & signatures
  const touchedEntities = mapDiffToEntities(simulatedDiff);

  // 2. Evaluate Risk Score, Blast Radius & Incident Correlation
  const report = evaluatePRRisk(touchedEntities);

  // 3. Format GitHub PR Comment
  const prComment = formatPRComment(report);

  console.log('--- GENERATED GITHUB PR COMMENT ---');
  console.log(prComment);
}

main().catch(console.error);
