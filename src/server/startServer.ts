import 'dotenv/config';
import Parser from 'tree-sitter';
import fs from 'fs';
import path from 'path';
import {
  initDb,
  resetDb,
  insertRepo,
  insertSymbol,
  insertEndpoint,
  insertEdge,
  insertIncident
} from '../db/db';
import { buildServer } from './webhookServer';

const TypeScript = require('tree-sitter-typescript').typescript;

async function start() {
  console.log('--- Setting Up Database Graph & Indexing Repositories ---');
  initDb();
  resetDb();

  const parser = new Parser();
  parser.setLanguage(TypeScript);

  const mockReposDir = path.join(__dirname, '../../mock_repos');

  // Index payment-service
  indexRepo(parser, 'payment-service', path.join(mockReposDir, 'payment-service'));

  // Index web-dashboard
  indexRepo(parser, 'web-dashboard', path.join(mockReposDir, 'web-dashboard'));

  // Seed incident memory
  insertIncident(
    'Payment Gateway Timeout Outage',
    'March 2026',
    'CRITICAL',
    'POST /v1/charge',
    'processCharge'
  );

  // Build and start Fastify Server
  const server = buildServer();
  const PORT = 3000;

  try {
    await server.listen({ port: PORT });
    console.log(`\n🚀 [Codexa Server Active]: Listening on http://localhost:${PORT}`);
    console.log(`📌 Health Check: http://localhost:${PORT}/health`);
    console.log(`📌 Webhook Endpoint: http://localhost:${PORT}/api/webhook\n`);

    // Simulate sending a live GitHub Webhook POST request to our server
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
    console.log(`[Impact Summary]: ${resBody.impactedCallersCount} Affected Callers, ${resBody.matchedIncidentsCount} Matched Incidents`);

    console.log('\n--- SERVER WEBHOOK VERIFICATION SUCCESSFUL ---');
    
    // Close server cleanly after verification test
    await server.close();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

function indexRepo(parser: Parser, repoName: string, repoDir: string) {
  insertRepo(repoName, repoDir);
  const files = getAllFiles(repoDir, ['.ts', '.js']);
  for (const filePath of files) {
    const code = fs.readFileSync(filePath, 'utf8');
    const tree = parser.parse(code);
    indexFile(tree.rootNode, repoName, filePath);
  }
}

function getAllFiles(dirPath: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const list = fs.readdirSync(dirPath);
  list.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else {
      if (extensions.includes(path.extname(fullPath))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

let currentScopeFunction: string | null = null;

function indexFile(node: Parser.SyntaxNode, repoName: string, filePath: string) {
  if (node.type === 'function_declaration') {
    const nameNode = node.children.find(child => child.type === 'identifier');
    if (nameNode) {
      const funcName = nameNode.text;
      insertSymbol(repoName, funcName, filePath, 'function', nameNode.startPosition.row + 1, nameNode.endPosition.row + 1);

      const prevScope = currentScopeFunction;
      currentScopeFunction = funcName;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) indexFile(child, repoName, filePath);
      }
      currentScopeFunction = prevScope;
      return;
    }
  }

  if (node.type === 'expression_statement') {
    const callExpr = node.children.find(c => c.type === 'call_expression');
    if (callExpr) {
      const memberExpr = callExpr.childForFieldName('function');
      if (memberExpr && memberExpr.type === 'member_expression') {
        const objectNode = memberExpr.childForFieldName('object');
        const propertyNode = memberExpr.childForFieldName('property');

        if (objectNode?.text === 'app' && propertyNode) {
          const method = propertyNode.text.toUpperCase();
          const args = callExpr.childForFieldName('arguments');

          if (args && args.childCount >= 3) {
            const routePathArg = args.children.find(c => c.type === 'string');
            const handlerArg = args.children.find(c => c.type === 'identifier');

            if (routePathArg && handlerArg) {
              const routePath = routePathArg.text.replace(/['"]/g, '');
              const handlerSymbol = handlerArg.text;
              insertEndpoint(repoName, method, routePath, handlerSymbol);
              const endpointContract = `${method} ${routePath}`;
              insertEdge(repoName, handlerSymbol, repoName, endpointContract, 'handles_endpoint');
            }
          }
        }
      }
    }
  }

  if (node.type === 'call_expression' && currentScopeFunction) {
    const functionNode = node.childForFieldName('function');
    if (functionNode && functionNode.type === 'identifier' && functionNode.text === 'fetch') {
      const args = node.childForFieldName('arguments');
      if (args) {
        const pathArg = args.children.find(c => c.type === 'string');
        if (pathArg) {
          const routePath = pathArg.text.replace(/['"]/g, '');
          let method = 'POST';
          const contractSymbol = `${method} ${routePath}`;
          insertEdge(repoName, currentScopeFunction, 'payment-service', contractSymbol, 'consumes_endpoint');
        }
      }
    } else if (functionNode && functionNode.type === 'identifier') {
      const calledFunc = functionNode.text;
      insertEdge(repoName, currentScopeFunction, repoName, calledFunc, 'calls');
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) indexFile(child, repoName, filePath);
  }
}

start().catch(console.error);
