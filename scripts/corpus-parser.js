/**
 * Tree-sitter Corpus Parser
 * A Node.js implementation of Tree-sitter's corpus test parser
 */

class CorpusParser {
  constructor() {
    this.sections = [];
  }

  /**
   * Parse a corpus test file
   * @param {string} content - The content of the corpus file
   * @returns {Object[]} Array of test sections
   */
  parse(content) {
    if (!content) return [];

    const lines = content.split('\n');
    let currentSection = null;
    let currentExample = null;
    let parsingSource = false;
    let parsingTree = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Section header (===)
      if (line.startsWith('===')) {
        if (currentSection && currentExample) {
          currentSection.examples.push(currentExample);
        }

        const name = line.replace(/^===+\s*/, '').replace(/\s*===+$/, '');
        currentSection = { name, examples: [] };
        this.sections.push(currentSection);
        currentExample = null;
        continue;
      }

      // Example header (---)
      if (line.startsWith('---')) {
        if (currentExample) {
          currentSection.examples.push(currentExample);
        }

        const name = line.replace(/^---+\s*/, '').replace(/\s*---+$/, '');
        currentExample = { name, source: '', tree: '' };
        parsingSource = true;
        parsingTree = false;
        continue;
      }

      if (currentExample) {
        if (!currentExample.source && line.trim() === '') {
          continue;
        }

        // Switch from source to tree when we see a line starting with '('
        if (parsingSource && line.trim().startsWith('(')) {
          parsingSource = false;
          parsingTree = true;
        }

        if (parsingSource) {
          currentExample.source += line + '\n';
        } else if (parsingTree) {
          currentExample.tree += line + '\n';
        }
      }
    }

    // Add the last example if there is one
    if (currentSection && currentExample) {
      currentSection.examples.push(currentExample);
    }

    // Clean up the parsed data
    for (const section of this.sections) {
      for (const example of section.examples) {
        example.source = example.source.trim();
        example.tree = example.tree.trim();
      }
    }

    return this.sections;
  }

  /**
   * Parse a corpus test file from a file path
   * @param {string} filepath - Path to the corpus file
   * @returns {Promise<Object[]>} Promise resolving to array of test sections
   */
  async parseFile(filepath) {
    const fs = require('fs').promises;
    const content = await fs.readFile(filepath, 'utf8');
    return this.parse(content);
  }

  /**
   * Run tests comparing actual and expected trees
   * @param {Object} grammar - The tree-sitter grammar to use for parsing
   * @param {string} filepath - Path to the corpus file
   */
  async validateCorpus(grammar, filepath) {
    const sections = await this.parseFile(filepath);
    const results = {
      passing: [],
      failing: []
    };

    for (const section of sections) {
      for (const example of section.examples) {
        const tree = grammar.parse(example.source);
        const treeString = tree.rootNode.toString();

        if (this.normalizeTree(treeString) === this.normalizeTree(example.tree)) {
          results.passing.push({
            section: section.name,
            example: example.name
          });
        } else {
          results.failing.push({
            section: section.name,
            example: example.name,
            expected: example.tree,
            actual: treeString
          });
        }
      }
    }

    return results;
  }

  /**
   * Normalize tree string for comparison
   * @param {string} tree - The tree string to normalize
   * @returns {string} Normalized tree string
   */
  normalizeTree(tree) {
    return tree.replace(/\s+/g, ' ').trim();
  }
}

module.exports = CorpusParser;
