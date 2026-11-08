#!/usr/bin/env node
// Generates the home-screen PNG icons from porto-app-icon.svg.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'public/porto-app-icon.svg'));
const outDir = join(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  await sharp(source, { density: Math.ceil((72 * size) / 1000) * 4 })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`wrote public/icons/icon-${size}.png`);
}
