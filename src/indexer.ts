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
  findUpstreamCallers
} from './db/db';

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
  console.log('--- 2. Phase 2 Cross-Repo Endpoint Impact Analysis ---');
  console.log('========================================================\n');

  const targetEndpointContract = 'POST /v1/charge';
  console.log(`SCENARIO: A breaking schema change is introduced to Endpoint: '${targetEndpointContract}' in 'payment-service'.`);
  console.log(`QUERY: "Which upstream symbols across ALL repos will break?"\n`);

  const blastRadius = findUpstreamCallers(targetEndpointContract);
  console.log('RESULT (Cross-Repository Blast Radius):');
  console.table(blastRadius);
}

function indexRepo(parser: Parser, repoName: string, repoDir: string) {
  console.log(`[Indexing Repo]: ${repoName} (${repoDir})`);
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
  // 1. Function Declaration (Symbols)
  if (node.type === 'function_declaration') {
    const nameNode = node.children.find(child => child.type === 'identifier');
    if (nameNode) {
      const funcName = nameNode.text;
      insertSymbol(
        repoName,
        funcName,
        filePath,
        'function',
        nameNode.startPosition.row + 1,
        nameNode.endPosition.row + 1
      );

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

  // 2. Route Definition AST Detection: app.post('/v1/charge', processCharge)
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

              console.log(`  └─ Exposing Endpoint [${method} ${routePath}] -> Handled by '${handlerSymbol}'`);
              insertEndpoint(repoName, method, routePath, handlerSymbol);

              const endpointContract = `${method} ${routePath}`;
              insertEdge(repoName, handlerSymbol, repoName, endpointContract, 'handles_endpoint');
            }
          }
        }
      }
    }
  }

  // 3. Client HTTP Request AST Detection: fetch('/v1/charge', { method: 'POST' })
  if (node.type === 'call_expression' && currentScopeFunction) {
    const functionNode = node.childForFieldName('function');
    if (functionNode && functionNode.type === 'identifier' && functionNode.text === 'fetch') {
      const args = node.childForFieldName('arguments');
      if (args) {
        const pathArg = args.children.find(c => c.type === 'string');
        if (pathArg) {
          const routePath = pathArg.text.replace(/['"]/g, '');
          
          let method = 'POST'; // Default or extracted from second arg
          const contractSymbol = `${method} ${routePath}`;

          console.log(`  └─ Consuming Endpoint [${contractSymbol}] inside '${currentScopeFunction}'`);

          // Cross-repo edge: currentScopeFunction (web-dashboard) -> calls -> contractSymbol (payment-service)
          insertEdge(repoName, currentScopeFunction, 'payment-service', contractSymbol, 'consumes_endpoint');
        }
      }
    } else if (functionNode && functionNode.type === 'identifier') {
      // Standard function call inside the same repo
      const calledFunc = functionNode.text;
      insertEdge(repoName, currentScopeFunction, repoName, calledFunc, 'calls');
    }
  }

  // Traverse children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) indexFile(child, repoName, filePath);
  }
}

main().catch(console.error);
