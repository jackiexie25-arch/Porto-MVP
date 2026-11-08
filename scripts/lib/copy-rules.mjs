import ts from 'typescript';

/** Words Porto never uses (section 4 of the brief). */
export const AVOID = [
  { pattern: /suffers?\s+from/i, word: 'suffers from' },
  { pattern: /special\s+needs/i, word: 'special needs' },
  { pattern: /\bwarriors?\b/i, word: 'warrior' },
  { pattern: /\bafflicted\b/i, word: 'afflicted' },
  { pattern: /\bwandering\b/i, word: 'wandering' },
  { pattern: /\belopement\b/i, word: 'elopement' },
  { pattern: /\bpuzzle/i, word: 'puzzle' },
];

/** American spellings to catch in the copy file. */
export const US_SPELLINGS = [
  { pattern: /\bbehavior/i, word: 'behavior (use behaviour)' },
  { pattern: /\bcolor(s|ed|ful)?\b/i, word: 'color (use colour)' },
  { pattern: /\bfavorite/i, word: 'favorite (use favourite)' },
  { pattern: /\borganiz/i, word: 'organiz- (use organis-)' },
  { pattern: /\bmom\b/i, word: 'mom (use mum)' },
];

function isModuleSpecifier(node) {
  const parent = node.parent;
  return (
    parent &&
    (ts.isImportDeclaration(parent) ||
      ts.isExportDeclaration(parent) ||
      (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword))
  );
}

/** Returns every user-facing string in a TS/TSX source: literals, template parts and JSX text. */
export function collectStrings(source, fileName) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];

  function visit(node) {
    let text = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) text = node.text;
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      text = node.text;
    } else if (ts.isJsxText(node)) {
      text = node.text.trim() || null;
    }
    if (text) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      found.push({ text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return found;
}

/** Problems in one file: avoid-list words, exclamation marks, and (copy file only) US spellings. */
export function findCopyProblems(source, fileName, { checkSpelling = false } = {}) {
  const problems = [];
  for (const { text, line } of collectStrings(source, fileName)) {
    for (const { pattern, word } of AVOID) {
      if (pattern.test(text)) problems.push({ line, message: `avoid-list word "${word}"`, text });
    }
    if (text.includes('!')) problems.push({ line, message: 'exclamation mark in a user-facing string', text });
    if (checkSpelling) {
      for (const { pattern, word } of US_SPELLINGS) {
        if (pattern.test(text)) problems.push({ line, message: `spelling: ${word}`, text });
      }
    }
  }
  return problems;
}
