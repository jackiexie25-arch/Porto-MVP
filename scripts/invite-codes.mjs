#!/usr/bin/env node
// Prints new random invite codes and the SQL to add them in the Supabase SQL editor.
// Usage: npm run invite-codes -- 10
// Codes are never committed to the repo.
import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L or 5/S, so codes are easy to read aloud and type.
const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';

function group(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function makeCode() {
  return `PORTO-${group(4)}-${group(4)}`;
}

const count = Math.min(Math.max(Number.parseInt(process.argv[2] ?? '5', 10) || 5, 1), 100);
const codes = Array.from({ length: count }, makeCode);

console.log('Codes (send one to each family):\n');
for (const code of codes) console.log(`  ${code}`);
console.log('\nSQL (paste into the Supabase SQL editor):\n');
console.log(
  `insert into public.invite_codes (code) values\n${codes.map((c) => `  ('${c}')`).join(',\n')};`,
);
