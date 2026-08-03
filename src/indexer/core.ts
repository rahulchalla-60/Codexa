import Parser from 'tree-sitter';
import fs from 'fs';
import path from 'path';
import {
  insertRepo,
  insertSymbol,
  insertEndpoint,
  insertEdge
} from '../db/db';
import { ingestRepoCodeowners } from '../memory/ownershipResolver';

export interface ScopeContext {
  name: string;
  signature: string;
}

export function indexRepo(parser: Parser, repoName: string, repoDir: string) {
  console.log(`[Indexing Repo]: ${repoName} (${repoDir})`);
  insertRepo(repoName, repoDir);

  // Automatically read real disk CODEOWNERS if present
  ingestRepoCodeowners(repoName, repoDir);

  const files = getAllFiles(repoDir, ['.ts', '.js']);
  for (const filePath of files) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const tree = parser.parse(code);
      indexFile(tree.rootNode, repoName, filePath, null);
    } catch (err: any) {
      console.warn(`[Parser Warning]: Failed to parse file ${filePath}: ${err.message}`);
    }
  }
}

export function getAllFiles(dirPath: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  try {
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
  } catch (err: any) {
    console.warn(`[FS Warning]: Failed to read directory ${dirPath}: ${err.message}`);
  }
  return results;
}

export function indexFile(
  node: Parser.SyntaxNode,
  repoName: string,
  filePath: string,
  currentScope: ScopeContext | null = null
) {
  const normFilePath = filePath.replace(/\\/g, '/');
  let activeScope = currentScope;

  // 1. Function Declaration (Symbols)
  if (node.type === 'function_declaration') {
    const nameNode = node.children.find(child => child.type === 'identifier');
    if (nameNode) {
      const funcName = nameNode.text;
      const funcSignature = `${repoName}::${normFilePath}::${funcName}`;

      insertSymbol(
        repoName,
        funcName,
        filePath,
        'function',
        nameNode.startPosition.row + 1,
        nameNode.endPosition.row + 1
      );

      activeScope = { name: funcName, signature: funcSignature };

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) indexFile(child, repoName, filePath, activeScope);
      }

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

              const handlerSignature = `${repoName}::${normFilePath}::${handlerSymbol}`;
              const endpointContract = `${method} ${routePath}`;
              insertEdge(handlerSignature, endpointContract, 'handles_endpoint');
            }
          }
        }
      }
    }
  }

  // 3. Client HTTP Request AST Detection: fetch('/v1/charge', { method: 'POST' })
  if (node.type === 'call_expression' && activeScope) {
    const functionNode = node.childForFieldName('function');
    if (functionNode && functionNode.type === 'identifier' && functionNode.text === 'fetch') {
      const args = node.childForFieldName('arguments');
      if (args) {
        const pathArg = args.children.find(c => c.type === 'string');
        if (pathArg) {
          const routePath = pathArg.text.replace(/['"]/g, '');
          let method = 'POST';
          const contractSymbol = `${method} ${routePath}`;

          console.log(`  └─ Consuming Endpoint [${contractSymbol}] inside '${activeScope.name}'`);
          insertEdge(activeScope.signature, contractSymbol, 'consumes_endpoint');
        }
      }
    } else if (functionNode && functionNode.type === 'identifier') {
      const calledFunc = functionNode.text;
      const calleeSignature = `${repoName}::${normFilePath}::${calledFunc}`;
      insertEdge(activeScope.signature, calleeSignature, 'calls');
    }
  }

  // Traverse children passing activeScope explicitly
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) indexFile(child, repoName, filePath, activeScope);
  }
}
