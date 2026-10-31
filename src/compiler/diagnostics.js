export function getLocation(source, offset) {
  const safeOffset = Math.max(0, Math.min(offset, (source || '').length));
  const before = (source || '').slice(0, safeOffset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1,
  };
}

export function enrichDiagnostics(diagnostics, _source = '') {
  return (diagnostics || []).map((diagnostic) => {
    const line = Math.max(1, Number(diagnostic.line) || 1);
    const col = Math.max(1, Number(diagnostic.col) || 1);
    const endLine = Math.max(line, Number(diagnostic.endLine) || line);
    const endCol = Math.max(col + 1, Number(diagnostic.endCol) || col + 1);

    const range = diagnostic.range || {
      startLine: line,
      startCol: col,
      endLine,
      endCol,
    };

    return {
      code: diagnostic.code || 'COMPILER_DIAGNOSTIC',
      type: diagnostic.severity || diagnostic.type || 'error',
      severity: diagnostic.severity || diagnostic.type || 'error',
      line,
      col,
      endLine,
      endCol,
      range,
      message: diagnostic.message || 'Diagnostic reported',
      explanation:
        diagnostic.explanation ||
        'The compiler detected a syntactic or semantic condition here.',
      suggestion:
        diagnostic.suggestion || 'Inspect the circuit source code.',
      fix: diagnostic.fix || null,
    };
  });
}

// Thin fallback scanner for raw delimiter matching if needed
export function analyzeSourceDiagnostics(source = '') {
  const diagnostics = [];
  const delimiterStack = [];
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inBlockComment) {
      if (char === '*' && source[i + 1] === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (char === '/' && source[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if ('([{'.includes(char)) {
      delimiterStack.push({ char, offset: i });
    } else if (')]}'.includes(char)) {
      const expected = { ')': '(', ']': '[', '}': '{' }[char];
      const top = delimiterStack[delimiterStack.length - 1];
      if (!top || top.char !== expected) {
        const loc = getLocation(source, i);
        diagnostics.push({
          code: 'E_UNEXPECTED_DELIMITER',
          severity: 'error',
          type: 'error',
          line: loc.line,
          col: loc.col,
          endLine: loc.line,
          endCol: loc.col + 1,
          range: { startLine: loc.line, startCol: loc.col, endLine: loc.line, endCol: loc.col + 1 },
          message: `Unexpected closing delimiter '${char}'`,
          explanation: `This delimiter does not match an opening '${expected || '('}'.`,
          suggestion: `Remove '${char}' or match with proper opening delimiter.`,
          fix: {
            kind: 'replace-range',
            line: loc.line,
            startCol: loc.col,
            endCol: loc.col + 1,
            replacement: '',
          },
        });
      } else {
        delimiterStack.pop();
      }
    }
  }

  delimiterStack.forEach(({ char, offset: position }) => {
    const closing = { '(': ')', '[': ']', '{': '}' }[char];
    const loc = getLocation(source, position);
    diagnostics.push({
      code: 'E_UNCLOSED_DELIMITER',
      severity: 'error',
      type: 'error',
      line: loc.line,
      col: loc.col,
      endLine: loc.line,
      endCol: loc.col + 1,
      range: { startLine: loc.line, startCol: loc.col, endLine: loc.line, endCol: loc.col + 1 },
      message: `Missing closing delimiter '${closing}'`,
      explanation: `The opening delimiter '${char}' has no matching closing delimiter.`,
      suggestion: `Add '${closing}' to close this block or expression.`,
      fix: {
        kind: 'append-line',
        replacement: closing,
      },
    });
  });

  return diagnostics;
}
