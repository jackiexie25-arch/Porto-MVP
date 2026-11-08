#!/usr/bin/env node
// Fails if any colour value appears outside the token files (brief, section 10, item 9).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ALLOWED_FILES, findColourLiterals } from './lib/colour-rules.mjs';
import { walk } from './lib/walk.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = walk(root, 'src', (name) => /\.(css|ts|tsx)$/.test(name)).filter(
  (file) => !ALLOWED_FILES.includes(file),
);

let count = 0;
for (const file of files) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const p of findColourLiterals(source, { css: file.endsWith('.css') })) {
    count += 1;
    console.error(`${file}:${p.line}  ${p.message}  (use a token from tokens.css)\n    ${p.text}`);
  }
}

if (count > 0) {
  console.error(`\nlint:hex found ${count} problem${count === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`lint:hex ok (${files.length} files)`);
