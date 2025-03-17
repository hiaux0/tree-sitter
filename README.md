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

[discord]: https://img.shields.io/discord/1063097320771698699?logo=discord&label=discord
[matrix]: https://img.shields.io/matrix/tree-sitter-chat%3Amatrix.org?logo=matrix&label=matrix

## Parsing Implementation and Extraction

### Parsing Implementation

The parsing implementation is primarily found in the following files:
- `cli/generate/src/parse_grammar.rs`
- `cli/generate/src/grammars.rs`

These files contain the core logic for parsing grammars and generating the corresponding syntax trees.

### Extraction Logic

The extraction logic is implemented in the following files:
- `cli/generate/src/prepare_grammar/mod.rs`
- Related modules within the `prepare_grammar` directory

These files handle the extraction and preparation of grammar rules for further processing.

### Script Conversion to Node.js

A new `scripts` folder has been created to house a script that converts the Rust code into a single Node.js file. This script can be used to leverage the parsing logic in a Node.js environment.
