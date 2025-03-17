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
            headerText: currentSection.name, // Use the extracted name as headerText
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
            headerText: name, // Store just the extracted name as headerText, not the full line
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
            headerText: currentSection.name, // Use the extracted name as headerText
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
        headerText: currentSection.name, // Use the extracted name as headerText
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
          headerText: test.headerText,
          metadata: test.metadata,
        });
      } else {
        results.failing.push({
          name: test.name,
          headerText: test.headerText,
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
      if (!args[1]) {
        console.error('Error: Missing corpus file path');
        process.exit(1);
      }

      try {
        const sections = await parser.parseFile(args[1]);
        console.log(JSON.stringify(sections, null, 2));
      } catch (error) {
        console.error('Error parsing corpus file:', error);
        process.exit(1);
      }
      break;

    case 'summary':
      if (!args[1]) {
        console.error('Error: Missing corpus file path');
        process.exit(1);
      }

      try {
        const sections = await parser.parseFile(args[1]);

        console.log(`Corpus File: ${args[1]}`);
        console.log(`Sections: ${sections.length}`);

        let totalExamples = 0;

        for (const section of sections) {
          console.log(`\nSection: ${section.name}`);
          console.log(`  Examples: ${section.examples.length}`);

          for (const example of section.examples) {
            console.log(`  - Input: ${example.metadata.inputCode.split('\n')[0]}${
              example.metadata.inputCode.split('\n').length > 1 ? ' ...' : ''
            }`);
            totalExamples++;
          }
        }

        console.log(`\nTotal examples: ${totalExamples}`);
      } catch (error) {
        console.error('Error parsing corpus file:', error);
        process.exit(1);
      }
      break;

    case 'extract':
      if (!args[1]) {
        console.error('Error: Missing directory path');
        process.exit(1);
      }

      try {
        const dir = args[1];
        const files = findCorpusFiles(dir);

        console.log(`Found ${files.length} corpus files:`);
        for (const file of files) {
          console.log(`- ${file}`);
        }

        if (files.length > 0) {
          const outputDir = path.join(process.cwd(), 'extracted-corpus');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          for (const file of files) {
            const sections = await parser.parseFile(file);
            const basename = path.basename(file, '.txt');
            const output = path.join(outputDir, `${basename}.json`);
            fs.writeFileSync(output, JSON.stringify(sections, null, 2));
            console.log(`Extracted ${file} to ${output}`);
          }
        }
      } catch (error) {
        console.error('Error extracting corpus files:', error);
        process.exit(1);
      }
      break;

    case 'validate':
      if (args.length < 3) {
        console.error('Error: Missing grammar path or corpus file path');
        console.error('Usage: corpus-test validate <grammar> <file>');
        process.exit(1);
      }

      try {
        const grammarPath = args[1];
        const corpusPath = args[2];

        // Check if grammar file exists
        if (!fs.existsSync(grammarPath)) {
          console.error(`Error: Grammar file not found: ${grammarPath}`);
          process.exit(1);
        }

        // Check if corpus file exists
        if (!fs.existsSync(corpusPath)) {
          console.error(`Error: Corpus file not found: ${corpusPath}`);
          process.exit(1);
        }

        // Load the grammar (assuming it's a JavaScript grammar or can be required)
        let grammar;
        try {
          grammar = require(path.resolve(grammarPath));
        } catch (e) {
          console.error(`Error loading grammar: ${e.message}`);
          process.exit(1);
        }

        // Validate corpus against grammar
        const results = await parser.validateCorpus(grammar, corpusPath);

        // Print results
        console.log(`\nValidation Results for ${corpusPath}:`);
        console.log(`Passing tests: ${results.passing.length}`);
        console.log(`Failing tests: ${results.failing.length}`);

        if (results.failing.length > 0) {
          console.log('\nFailing Tests:');
          for (const failure of results.failing) {
            console.log(`\nSection: ${failure.section}`);
            console.log(`Example at line ${failure.metadata.line}`);
            console.log(`\nExpected Tree:`);
            console.log(failure.expected);
            console.log(`\nActual Tree:`);
            console.log(failure.actual);
            console.log('\n---');
          }
          process.exit(1);
        } else {
          console.log('\nAll tests passed!');
        }
      } catch (error) {
        console.error('Error validating corpus file:', error);
        process.exit(1);
      }
      break;

    default:
      console.error(`Unknown command: ${command}`);
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
