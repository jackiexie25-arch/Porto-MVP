/**
 * Raw colour values are allowed only in the token files (and in .svg logo files, which are not scanned).
 * Everything else must use var(--token).
 */
export const ALLOWED_FILES = ['src/styles/tokens.css', 'src/styles/derived-tokens.css'];

const PATTERNS = [
  { pattern: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g, kind: 'hex colour' },
  { pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g, kind: 'colour function' },
];

const NAMED = /(?:color|background|fill|stroke|border(?:-[a-z]+)?|outline|box-shadow)\s*:\s*[^;]*\b(?:white|black|red|blue|green|grey|gray)\b/gi;

export function findColourLiterals(source, { css = false } = {}) {
  const problems = [];
  const lines = source.split('\n');
  lines.forEach((text, i) => {
    for (const { pattern, kind } of PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) problems.push({ line: i + 1, message: `${kind} "${match[0]}"`, text: text.trim() });
    }
    if (css) {
      NAMED.lastIndex = 0;
      const match = NAMED.exec(text);
      if (match) problems.push({ line: i + 1, message: 'named colour', text: text.trim() });
    }
  });
  return problems;
}
