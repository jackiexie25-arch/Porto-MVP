import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Lists files under `dir` (relative to `root`, with forward slashes) whose names pass `filter`. */
export function walk(root, dir, filter) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(root, rel, filter));
    } else if (filter(entry.name)) {
      out.push(relative(root, join(root, rel)).split(sep).join('/'));
    }
  }
  return out;
}
