const fs = require('fs');
const path = require('path');
const Parser = require('tree-sitter');
const Rust = require('tree-sitter-rust');

// Function to parse test corpus using Tree-sitter
function parseTestCorpus(testCorpus) {
  const parser = new Parser();
  parser.setLanguage(Rust);

  const tree = parser.parse(testCorpus);
  return tree;
}

// Example usage of parsing test corpus
const testCorpus = fs.readFileSync(path.join(__dirname, 'test_corpus.txt'), 'utf8');
const tree = parseTestCorpus(testCorpus);
console.log(tree.rootNode.toString());
