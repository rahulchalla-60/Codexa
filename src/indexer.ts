import Parser from 'tree-sitter';
import fs from 'fs';
import path from 'path';
import { initDb, resetDb, insertSymbol, insertEdge, findUpstreamCallers } from './db/db';

const TypeScript = require('tree-sitter-typescript').typescript;

async function main() {
  // 1. Initialize and clear DB for a clean index run
  initDb();
  resetDb();

  // 2. Initialize Parser
  const parser = new Parser();
  parser.setLanguage(TypeScript);

  // 3. Read sample file
  const samplePath = path.join(__dirname, '../sample.ts');
  const sourceCode = fs.readFileSync(samplePath, 'utf8');

  // 4. Parse AST
  const tree = parser.parse(sourceCode);

  console.log('--- 1. Indexing Source File Into Database ---');
  indexFile(tree.rootNode, samplePath);

  console.log('Symbols and Edges populated successfully into SQLite graph database.');

  console.log('\n--- 2. Running Graph Traversal Query (Recursive CTE) ---');
  const targetFunction = 'calculateBlastRadius';
  console.log(`Query: "What functions break if '${targetFunction}' is modified?"`);

  const callers = findUpstreamCallers(targetFunction);
  console.log('\nResult (Upstream Impact / Blast Radius):');
  console.table(callers);
}

let currentScopeFunction: string | null = null;

function indexFile(node: Parser.SyntaxNode, filePath: string) {
  // Check for function declarations (Symbols)
  if (node.type === 'function_declaration') {
    const nameNode = node.children.find(child => child.type === 'identifier');
    if (nameNode) {
      const funcName = nameNode.text;
      insertSymbol(
        funcName,
        filePath,
        'function',
        nameNode.startPosition.row + 1,
        nameNode.endPosition.row + 1
      );
      
      const previousScope = currentScopeFunction;
      currentScopeFunction = funcName;

      // Parse body for calls inside this function
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) indexFile(child, filePath);
      }

      currentScopeFunction = previousScope;
      return;
    }
  }

  // Check for function call invocations (Edges)
  if (node.type === 'call_expression' && currentScopeFunction) {
    const functionNode = node.childForFieldName('function');
    if (functionNode && functionNode.type === 'identifier') {
      const calledFuncName = functionNode.text;
      // Record edge: currentScopeFunction -> calls -> calledFuncName
      insertEdge(currentScopeFunction, calledFuncName, 'calls');
    }
  }

  // Traverse all children recursively
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      indexFile(child, filePath);
    }
  }
}

main().catch(console.error);
