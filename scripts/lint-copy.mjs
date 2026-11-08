#!/usr/bin/env node
// Fails if user-facing strings use avoid-list words or exclamation marks (brief, section 4).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findCopyProblems } from './lib/copy-rules.mjs';
import { walk } from './lib/walk.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY_FILE = 'src/copy/en-AU.ts';

const files = [
  COPY_FILE,
  ...walk(root, 'src', (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx')),
  // Demo content is shown to people, so it follows the same voice rules.
  ...walk(root, 'src/demo', (name) => name.endsWith('.ts')),
];

let count = 0;
for (const file of files) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const p of findCopyProblems(source, file, { checkSpelling: file === COPY_FILE })) {
    count += 1;
    console.error(`${file}:${p.line}  ${p.message}\n    ${JSON.stringify(p.text)}`);
  }
}

if (count > 0) {
  console.error(`\nlint:copy found ${count} problem${count === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`lint:copy ok (${files.length} files)`);
