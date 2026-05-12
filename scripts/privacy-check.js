#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const explicitPaths = process.argv.slice(2);

const ignoredPathPatterns = [
  /^\.git\//,
  /^dist\//,
  /^node_modules\//,
  /^package-lock\.json$/,
  /^images\//,
  /^scripts\/privacy-check\.js$/
];

const patterns = [
  {
    name: 'secret or credential',
    regex: /\b(api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret|CLOUDFLARE_API|TWILIO|CLICKSEND)\b/i
  },
  {
    name: 'private board dashboard architecture',
    regex: /\b(data flow|architecture|cloudflare access|zero trust|email allowlist|30-day sessions|board dashboard|private dashboard)\b/i
  },
  {
    name: 'private financial operations',
    regex: /\b(financial dashboard|reserve fund|operating balance|YTD income|CD details|Eisenstein|quarterly financials)\b/i
  },
  {
    name: 'resident contact data handling',
    regex: /\b(resident phones?|SMS recipients?|mobile phone|phone numbers?|Google Sheets API|shared Drive|ClickSend|Perplexity)\b/i
  },
  {
    name: 'phone number-like value',
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/
  },
  {
    name: 'non-board email address',
    regex: /\b(?!board@madisongardens408\.com\b)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  }
];

function gitLines(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function candidateFiles() {
  if (explicitPaths.length > 0) {
    return explicitPaths;
  }

  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...staged, ...untracked])];
}

function isIgnored(relativePath) {
  return ignoredPathPatterns.some((pattern) => pattern.test(relativePath));
}

function isTextFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.includes(0)) {
    return false;
  }
  return buffer.length <= 1024 * 1024;
}

function scanFile(relativePath) {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.resolve(repoRoot, relativePath);
  const isInsideRepo = absolutePath.startsWith(`${repoRoot}${path.sep}`);
  const displayPath = isInsideRepo ? path.relative(repoRoot, absolutePath) : absolutePath;
  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    return [];
  }
  if ((isInsideRepo && isIgnored(displayPath)) || !isTextFile(absolutePath)) {
    return [];
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  const findings = [];
  lines.forEach((line, index) => {
    patterns.forEach(({ name, regex }) => {
      if (regex.test(line)) {
        findings.push({ file: displayPath, line: index + 1, name, text: line.trim().slice(0, 180) });
      }
    });
  });
  return findings;
}

const files = candidateFiles();
const findings = files.flatMap(scanFile);

if (findings.length === 0) {
  console.log('Privacy check passed: no obvious board-private content, PII, or credentials found in candidate files.');
  process.exit(0);
}

console.error('Privacy check found content that should be reviewed before publishing this public repo:\n');
findings.forEach((finding) => {
  console.error(`${finding.file}:${finding.line} [${finding.name}] ${finding.text}`);
});
console.error('\nMove private board docs to spaltrowitz/private-docs instead of committing them here.');
process.exit(1);
