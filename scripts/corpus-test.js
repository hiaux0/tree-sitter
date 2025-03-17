#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Tree-sitter Enhanced Corpus Parser
 * A Node.js implementation of Tree-sitter's corpus test parser with metadata extraction
 */
class CorpusParser {
  constructor() {
    this.tests = []; // Renamed from sections to tests to better reflect the new structure
  }

  /**
   * Parse a corpus test file
   * @param {string} content - The content of the corpus file
   * @param {string} [filepath=null] - Optional file path for the corpus file
   * @returns {Object[]} Array of test objects
   */
  parse(content, filepath = null) {
    if (!content) return [];

    const lines = content.split("\n");
    let currentSection = null;
    let currentExample = null;
    let parsingSource = false;
    let parsingTree = false;

    let startHeaderIndex = NaN;
    let endHeaderIndex = NaN;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Section header (===)
      if (line.startsWith("===")) {
        if (currentSection && currentExample) {
          // Create unified test object instead of separate section/example
          this.tests.push({
            title: currentSection.name, // Use the extracted name as title
            name: currentSection.name + " - " + currentExample.name,
            code: currentExample.source.trim(),
            parsed: currentExample.tree.trim(),
            metadata: {
              filepath: filepath,
              sectionName: currentSection.name,
              exampleName: currentExample.name,
              sectionLine: currentSection.metadata.line,
              exampleLine: currentExample.metadata.line,
              description: currentSection.metadata.description.trim(),
            },
          });
        }

        if (!Number.isNaN(startHeaderIndex) && Number.isNaN(endHeaderIndex)) {
          endHeaderIndex = i;
        }
        if (Number.isNaN(startHeaderIndex)) {
          startHeaderIndex = i;
        }

        const name = line.replace(/^===+\s*/, "").replace(/\s*===+$/, "");
        currentSection = {
          name,
          metadata: {
            filepath: filepath,
            header: name,
            line: i + 1,
            title: name, // Store just the extracted name as title, not the full line
            rawHeaderLine: line, // Keep the original line with equals signs if needed
            description: "", // Will store description text if present
          },
        };
        currentExample = null;
        continue;
      }

      // Collect description text for the section (text between section header and first example)
      if (
        currentSection &&
        !currentExample &&
        line.trim() !== "" &&
        !line.startsWith("---")
      ) {
        currentSection.metadata.description += line + "\n";
      }

      // Example header (---)
      if (line.startsWith("---")) {
        if (currentExample) {
          // Create unified test object for previous example
          this.tests.push({
            title: currentSection.name, // Use the extracted name as title
            name: currentSection.name + " - " + currentExample.name,
            code: currentExample.source.trim(),
            parsed: currentExample.tree.trim(),
            metadata: {
              filepath: filepath,
              sectionName: currentSection.name,
              exampleName: currentExample.name,
              sectionLine: currentSection.metadata.line,
              exampleLine: currentExample.metadata.line,
              description: currentSection.metadata.description.trim(),
            },
          });
        }

        const name = line.replace(/^---+\s*/, "").replace(/\s*---+$/, "");
        currentExample = {
          name,
          source: "",
          tree: "",
          metadata: {
            line: i + 1,
            separator: line,
          },
        };
        parsingSource = true;
        parsingTree = false;
        continue;
      }

      if (currentExample) {
        if (!currentExample.source && line.trim() === "") {
          continue;
        }

        // Switch from source to tree when we see a line starting with '('
        if (parsingSource && line.trim().startsWith("(")) {
          parsingSource = false;
          parsingTree = true;
        }

        if (parsingSource) {
          currentExample.source += line + "\n";
        } else if (parsingTree) {
          currentExample.tree += line + "\n";
        }
      }
    }

    const nameLines = lines.slice(startHeaderIndex + 1, endHeaderIndex);
    const name = nameLines.join("\n").trim();
    currentSection.name = name;

    // Add the last example if there is one
    if (currentSection && currentExample) {
      this.tests.push({
        title: currentSection.name, // Use the extracted name as title
        code: currentSection.metadata.description.trim(),
        parsed: currentExample.tree.trim(),
        filepath: filepath,
        metadata: {
          sectionLine: currentSection.metadata.line,
          exampleLine: currentExample.metadata.line,
        },
      });
    }

    return this.tests;
  }

  /**
   * Parse a corpus test file from a file path
   * @param {string} filepath - Path to the corpus file
   * @returns {Promise<Object[]>} Promise resolving to array of test objects
   */
  async parseFile(filepath) {
    const fs = require("fs").promises;
    const content = await fs.readFile(filepath, "utf8");
    return this.parse(content, filepath);
  }

  /**
   * Run tests comparing actual and expected trees
   * @param {Object} grammar - The tree-sitter grammar to use for parsing
   * @param {string} filepath - Path to the corpus file
   */
  async validateCorpus(grammar, filepath) {
    const tests = await this.parseFile(filepath);
    const results = {
      passing: [],
      failing: [],
    };

    for (const test of tests) {
      const tree = grammar.parse(test.code);
      const treeString = tree.rootNode.toString();

      if (this.normalizeTree(treeString) === this.normalizeTree(test.parsed)) {
        results.passing.push({
          name: test.name,
          title: test.title,
          metadata: test.metadata,
        });
      } else {
        results.failing.push({
          name: test.name,
          title: test.title,
          expected: test.parsed,
          actual: treeString,
          metadata: test.metadata,
        });
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
    return tree.replace(/\s+/g, " ").trim();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: corpus-test <command> [options]');
    console.error('');
    console.error('Commands:');
    console.error('  parse <file>             Parse a corpus test file and output JSON');
    console.error('  validate <grammar> <file> Validate a corpus against a grammar');
    console.error('  extract <directory>      Extract all corpus files from a directory');
    console.error('  summary <file>           Print a summary of a corpus file');
    process.exit(1);
  }

  const command = args[0];
  const parser = new CorpusParser();

  switch (command) {
    case 'parse':
      if (args.length < 2) {
        console.error('Error: Missing corpus file path');
        process.exit(1);
      }
      await handleParse(parser, args[1]);
      break;

    case 'validate':
      if (args.length < 3) {
        console.error('Error: Missing grammar path or corpus file path');
        process.exit(1);
      }
      await handleValidate(parser, args[1], args[2]);
      break;

    case 'extract':
      if (args.length < 2) {
        console.error('Error: Missing directory path');
        process.exit(1);
      }
      await handleExtract(parser, args[1]);
      break;

    case 'summary':
      if (args.length < 2) {
        console.error('Error: Missing corpus file path');
        process.exit(1);
      }
      await handleSummary(parser, args[1]);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

/**
 * Parse a corpus file and output JSON
 * @param {CorpusParser} parser - The corpus parser instance
 * @param {string} filepath - Path to the corpus file
 */
async function handleParse(parser, filepath) {
  try {
    const tests = await parser.parseFile(filepath);
    console.log(JSON.stringify(tests, null, 2));
  } catch (error) {
    console.error(`Error parsing file ${filepath}: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate a corpus against a grammar
 * @param {CorpusParser} parser - The corpus parser instance
 * @param {string} grammarPath - Path to the Tree-sitter grammar
 * @param {string} corpusPath - Path to the corpus file
 */
async function handleValidate(parser, grammarPath, corpusPath) {
  try {
    // Load the grammar
    const absoluteGrammarPath = path.resolve(grammarPath);
    // Try to load the grammar as a Node.js module
    let grammar;
    try {
      grammar = require(absoluteGrammarPath);
    } catch (e) {
      // If it's not a direct module, assume it's a compiled .wasm file
      if (!fs.existsSync(absoluteGrammarPath)) {
        throw new Error(`Grammar file not found: ${absoluteGrammarPath}`);
      }

      // Try to use Tree-sitter's API to load the grammar
      const Parser = require('tree-sitter');
      const Language = require('tree-sitter/bindings/node');
      grammar = new Parser();
      grammar.setLanguage(Language.loadLanguage(absoluteGrammarPath));
    }

    const results = await parser.validateCorpus(grammar, corpusPath);

    console.log(`\nTest Results for ${corpusPath}:`);
    console.log(`✓ Passing: ${results.passing.length} tests`);
    if (results.failing.length > 0) {
      console.log(`✗ Failing: ${results.failing.length} tests`);

      for (const failure of results.failing) {
        console.log(`\n✗ FAIL: ${failure.name}`);
        console.log(`  Location: ${failure.metadata.filepath}:${failure.metadata.exampleLine}`);
        console.log('  Expected:');
        console.log(`  ${failure.expected.split('\n').join('\n  ')}`);
        console.log('  Actual:');
        console.log(`  ${failure.actual.split('\n').join('\n  ')}`);
      }

      process.exit(1);
    } else {
      console.log('All tests passed!');
    }
  } catch (error) {
    console.error(`Error validating corpus: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Extract all corpus files from a directory
 * @param {CorpusParser} parser - The corpus parser instance
 * @param {string} directory - Path to the directory
 */
async function handleExtract(parser, directory) {
  try {
    const corpusFiles = findCorpusFiles(directory);
    console.log(`Found ${corpusFiles.length} corpus files in ${directory}`);

    const allTests = [];
    for (const file of corpusFiles) {
      console.log(`Parsing ${file}...`);
      const tests = await parser.parseFile(file);
      allTests.push(...tests);
    }

    console.log(`Extracted ${allTests.length} tests from ${corpusFiles.length} files`);
    console.log(JSON.stringify(allTests, null, 2));
  } catch (error) {
    console.error(`Error extracting corpus files: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Print a summary of a corpus file
 * @param {CorpusParser} parser - The corpus parser instance
 * @param {string} filepath - Path to the corpus file
 */
async function handleSummary(parser, filepath) {
  try {
    const tests = await parser.parseFile(filepath);
    console.log(`\nCorpus Summary for ${filepath}:`);
    console.log(`Total tests: ${tests.length}`);

    // Group tests by section
    const sections = {};
    for (const test of tests) {
      const section = test.metadata.sectionName;
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(test);
    }

    console.log(`Total sections: ${Object.keys(sections).length}`);

    // Print section details
    for (const [section, sectionTests] of Object.entries(sections)) {
      console.log(`\n${section} (${sectionTests.length} tests):`);
      for (const test of sectionTests) {
        console.log(`  - ${test.metadata.exampleName || 'Unnamed Example'} (Line ${test.metadata.exampleLine})`);
      }
    }
  } catch (error) {
    console.error(`Error summarizing file ${filepath}: ${error.message}`);
    process.exit(1);
  }
}

function findCorpusFiles(dir) {
  const results = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);

    if (stat.isDirectory()) {
      results.push(...findCorpusFiles(filepath));
    } else if (file.endsWith('.txt')) {
      // Check if it looks like a corpus file
      const content = fs.readFileSync(filepath, 'utf8');
      if (content.includes('===') && content.includes('---')) {
        results.push(filepath);
      }
    }
  }

  return results;
}

main().catch(console.error);
