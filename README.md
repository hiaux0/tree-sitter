# tree-sitter

[![DOI](https://zenodo.org/badge/14164618.svg)](https://zenodo.org/badge/latestdoi/14164618)
[![discord][discord]](https://discord.gg/w7nTvsVJhm)
[![matrix][matrix]](https://matrix.to/#/#tree-sitter-chat:matrix.org)

Tree-sitter is a parser generator tool and an incremental parsing library. It can build a concrete syntax tree for a source file and efficiently update the syntax tree as the source file is edited. Tree-sitter aims to be:

- **General** enough to parse any programming language
- **Fast** enough to parse on every keystroke in a text editor
- **Robust** enough to provide useful results even in the presence of syntax errors
- **Dependency-free** so that the runtime library (which is written in pure C) can be embedded in any application

## Links
- [Documentation](https://tree-sitter.github.io)
- [Rust binding](lib/binding_rust/README.md)
- [WASM binding](lib/binding_web/README.md)
- [Command-line interface](cli/README.md)

## Corpus Testing

Tree-sitter uses a corpus-based testing approach to validate grammar implementations. This section explains how to use and leverage the corpus testing functionality.

### Understanding Corpus Files

Corpus files (`.txt`) contain test cases with input code and expected parse trees. They follow this format:

```
===================
SECTION NAME
===================

source_code_example;

---

(expected_parse_tree
  (with_nodes))
```

### Corpus Parsing Implementation

The corpus parsing is implemented in two main files:

1. `scripts/corpus-parser.js` - Core parsing logic as a reusable class
2. `scripts/corpus-test.js` - Command-line interface for working with corpus files

### Using the Corpus Parser in Your Project

To use the corpus parser in your own application:

1. Copy the `corpus-parser.js` file to your project
2. Import and use the parser:

```javascript
const CorpusParser = require('./path/to/corpus-parser');

async function testGrammar() {
  const parser = new CorpusParser();
  const sections = await parser.parseFile('/path/to/corpus.txt');

  // Process sections and examples
  for (const section of sections) {
    for (const example of section.examples) {
      console.log(`Testing: ${example.source}`);
      // Parse with your grammar and compare to example.tree
    }
  }
}
```

### Command-line Usage

The `corpus-test.js` script provides several commands to work with corpus files:

```bash
# Parse a corpus file and output as JSON
node scripts/corpus-test.js parse path/to/corpus.txt

# Validate a corpus against a grammar
node scripts/corpus-test.js validate path/to/grammar.js path/to/corpus.txt

# Extract all corpus files from a directory
node scripts/corpus-test.js extract path/to/directory

# Print a summary of a corpus file
node scripts/corpus-test.js summary path/to/corpus.txt
```

### Metadata Available

The parser extracts rich metadata from corpus files:

- Section information (name, description)
- Example details (source code, expected parse tree)
- File location information (filepath, line numbers)

This metadata can be used for generating reports, IDE integrations, or custom testing frameworks.

[discord]: https://img.shields.io/discord/1063097320771698699?logo=discord&label=discord
[matrix]: https://img.shields.io/matrix/tree-sitter-chat%3Amatrix.org?logo=matrix&label=matrix
