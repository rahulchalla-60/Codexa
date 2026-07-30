// src/indexer.ts
import Parser from 'tree-sitter';
import fs from 'fs';
import path from 'path';

// Load the TypeScript grammar
const TypeScript = require('tree-sitter-typescript').typescript;

async function main() {
  // Initialize the parser
  const parser = new Parser();
  parser.setLanguage(TypeScript);

  // Read our sample source code file
  const samplePath = path.join(__dirname, '../sample.ts');
  const sourceCode = fs.readFileSync(samplePath, 'utf8');

  // Parse the code into an AST
  const tree = parser.parse(sourceCode);

  console.log('--- Full AST Structure ---');
  console.log(tree.rootNode.toString());

  console.log('\n--- Extracted Symbols (Phase 1 Goal) ---');
  extractFunctions(tree.rootNode);
}

// A simple manual traversal to find function names
function extractFunctions(node: Parser.SyntaxNode) {
  // Check if this node is a function declaration
  if (node.type === 'function_declaration') {
    // The name of the function is usually a child node called 'identifier'
    const nameNode = node.children.find(child => child.type === 'identifier');
    if (nameNode) {
      console.log(`Found function: '${nameNode.text}' on line ${nameNode.startPosition.row + 1}`);
    }
  }

  // Recursively check all children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      extractFunctions(child);
    }
  }
}

main().catch(console.error);
