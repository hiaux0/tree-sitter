#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CorpusParser = require('./corpus-parser');

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
