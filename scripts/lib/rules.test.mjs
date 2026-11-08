import { describe, expect, it } from 'vitest';
import { findCopyProblems } from './copy-rules.mjs';
import { findColourLiterals } from './colour-rules.mjs';

describe('copy rules', () => {
  it('flags avoid-list words in string literals and JSX text', () => {
    const src = `export const a = 'He suffers from noise';\nexport const B = () => <p>special needs</p>;`;
    const problems = findCopyProblems(src, 'x.tsx');
    expect(problems.map((p) => p.message)).toEqual([
      'avoid-list word "suffers from"',
      'avoid-list word "special needs"',
    ]);
  });

  it('flags exclamation marks in strings but not the ! operator', () => {
    const src = `const ok = !value && a !== b;\nconst s = 'Great job!';\nconst t = \`Hi \${name}!\`;`;
    const problems = findCopyProblems(src, 'x.ts');
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => p.message.includes('exclamation'))).toBe(true);
  });

  it('ignores import paths', () => {
    const src = `import x from './wandering-thing';`;
    expect(findCopyProblems(src, 'x.ts')).toEqual([]);
  });

  it('checks Australian spelling only when asked', () => {
    const src = `const s = 'Their behavior and favorite color';`;
    expect(findCopyProblems(src, 'x.ts')).toEqual([]);
    expect(findCopyProblems(src, 'x.ts', { checkSpelling: true })).toHaveLength(3);
  });

  it('accepts plain, kind copy', () => {
    const src = `const s = 'Offer the same food again before trying something new.';`;
    expect(findCopyProblems(src, 'x.ts', { checkSpelling: true })).toEqual([]);
  });
});

describe('colour rules', () => {
  it('flags hex and colour functions', () => {
    const src = `.a { color: #24304F; }\n.b { background: rgba(0, 0, 0, 0.5); }\n.c { fill: #fff; }`;
    expect(findColourLiterals(src, { css: true })).toHaveLength(3);
  });

  it('flags named colours in CSS', () => {
    expect(findColourLiterals('.a { background: white; }', { css: true })).toHaveLength(1);
  });

  it('allows tokens and anchors', () => {
    const src = `.a { color: var(--ink); }\n<a href="#main">Skip</a>`;
    expect(findColourLiterals(src, { css: true })).toEqual([]);
  });
});
