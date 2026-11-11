import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The worker view is its own bundle: a worker on a phone must never download the Supabase client
 * or the family app's sign-in. This walks every import reachable from the worker's entry point
 * (src/worker/WorkerPage.tsx, which App.tsx lazy-loads) and fails if any of them reach Supabase.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = resolve(SRC, 'worker/WorkerPage.tsx');

// `import x from 'y'`, `import 'y'`, `export { x } from 'y'` and `import('y')`. Type-only imports
// are erased at build time, so they're skipped.
const IMPORT = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveLocal(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

function workerGraph(): { files: string[]; packages: Set<string> } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [ENTRY];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(IMPORT)) {
      if (match[2]) continue;
      const spec = match[3] ?? match[4]!;
      if (spec.startsWith('.')) {
        const target = resolveLocal(file, spec);
        if (target) queue.push(target);
      } else {
        packages.add(spec);
      }
    }
  }
  return { files: [...seen].map((f) => relative(SRC, f)).sort(), packages };
}

describe('worker bundle', () => {
  const { files, packages } = workerGraph();

  it('finds the worker code it walks', () => {
    expect(files).toContain('worker/WorkerView.tsx');
    expect(files).toContain('components/cues/MeaningView.tsx');
    expect(files).toContain('components/ui/SearchField.tsx');
  });

  it('never imports the Supabase client, directly or through shared code', () => {
    expect([...packages].filter((p) => p.startsWith('@supabase/'))).toEqual([]);
  });

  it('never imports the family app’s data, auth or Supabase setup', () => {
    expect(files.filter((f) => /^(auth|data\/(?!types\.ts$)|family\/)|^lib\/supabase\.ts$/.test(f))).toEqual([]);
  });
});
