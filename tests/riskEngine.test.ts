import test from 'node:test';
import assert from 'node:assert';
import { evaluatePRRisk } from '../src/analyzer/riskEngine';
import { parseAndRegisterCodeowners, getOwnerTeam } from '../src/memory/ownershipResolver';
import { initDb, resetDb } from '../src/db/db';

test('Depth-Weighted Risk Scoring Calculation', () => {
  initDb();
  resetDb();

  const touchedEntities = [
    {
      repoName: 'test-repo',
      symbolName: 'localFunction',
      entitySignature: 'test-repo::src/utils.ts::localFunction',
      kind: 'function',
      filePath: 'src/utils.ts',
      startLine: 1,
      endLine: 10
    }
  ];

  const report = evaluatePRRisk(touchedEntities);

  // Isolated function with 0 callers and no incidents should have LOW risk (Score <= 30)
  assert.strictEqual(report.riskLevel, 'LOW');
  assert.ok(report.riskScore <= 30);
});

test('CODEOWNERS File Parsing and Wildcard Rule Resolution', () => {
  initDb();
  resetDb();

  const codeownersContent = `
# CODEOWNERS Test Rules
src/payment/*.ts @payments-squad
* @core-engineering-team
  `;

  parseAndRegisterCodeowners('test-repo', codeownersContent);

  // Exact rule match
  const exactMatch = getOwnerTeam('charge', 'test-repo', 'src/payment/checkout.ts');
  assert.strictEqual(exactMatch.ownerHandle, '@payments-squad');
  assert.strictEqual(exactMatch.confidence, 'HIGH');

  // Wildcard rule match
  const wildcardMatch = getOwnerTeam('randomFunc', 'test-repo', 'src/common/helpers.ts');
  assert.strictEqual(wildcardMatch.ownerHandle, '@core-engineering-team');
  assert.strictEqual(wildcardMatch.confidence, 'MEDIUM');
});
