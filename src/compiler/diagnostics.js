const GATE_NAMES = new Set([
  'and',
  'or',
  'not',
  'xor',
  'nand',
  'nor',
  'xnor',
  'buf',
  'dff',
]);
function getLocation(source, offset) {
  const safeOffset = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, safeOffset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1,
  };
}
function makeDiagnostic(
  source,
  offset,
  message,
  explanation,
  suggestion,
  type = 'error',
  fix = null
) {
  const location = getLocation(source, offset);
  return {
    type,
    severity: type,
    ...location,
    message,
    explanation,
    suggestion,
    ...(fix ? { fix } : {}),
  };
}
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = previous;
    }
  }
  return row[b.length];
}
export function analyzeSourceDiagnostics(source) {
  const diagnostics = [];
  const declared = new Set();
  const declarationRegex =
    /^\s*(input|output|wire)\s+([A-Za-z_]\w*)(?:\s*\[\s*\d+\s*\])?(?:\s*:\s*Wire)?\s*;?\s*$/;
  const lines = source.split('\n');
  let offset = 0;
  const delimiterStack = [];
  let inLineComment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\n') {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;
    if (char === '/' && source[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    if ('([{'.includes(char)) {
      delimiterStack.push({ char, offset: i });
    } else if (')]}'.includes(char)) {
      const expected = { ')': '(', ']': '[', '}': '{' }[char];
      const top = delimiterStack[delimiterStack.length - 1];
      if (!top || top.char !== expected) {
        diagnostics.push(
          makeDiagnostic(
            source,
            i,
            `Unexpected closing delimiter '${char}'.`,
            'This closing delimiter does not match the most recent opening delimiter.',
            `Remove '${char}' or add its matching opening delimiter.`,
            'error',
            {
              kind: 'replace-range',
              line: getLocation(source, i).line,
              startCol: getLocation(source, i).col,
              endCol: getLocation(source, i).col + 1,
              replacement: '',
            }
          )
        );
      } else {
        delimiterStack.pop();
      }
    }
  }
  delimiterStack.forEach(({ char, offset: position }) => {
    const closing = { '(': ')', '[': ']', '{': '}' }[char];
    diagnostics.push(
      makeDiagnostic(
        source,
        position,
        `Missing closing delimiter '${closing}'.`,
        `The opening delimiter '${char}' has no matching closing delimiter.`,
        `Add '${closing}' in the correct position.`,
        'error',
        {
          kind: 'append-line',
          replacement: closing,
        }
      )
    );
  });
  offset = 0;
  lines.forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, '');
    const trimmed = code.trim();
    const lineOffset = offset;
    offset += line.length + 1;
    if (!trimmed || trimmed.startsWith('//')) return;
    const declaration = trimmed.match(declarationRegex);
    if (declaration) {
      const [, kind, name] = declaration;
      const position = lineOffset + line.indexOf(name);
      if (declared.has(name)) {
        diagnostics.push(
          makeDiagnostic(
            source,
            position,
            `Duplicate declaration '${name}'.`,
            `The signal '${name}' has already been declared.`,
            `Use a different signal name or remove the duplicate declaration.`
          )
        );
      } else {
        declared.add(name);
      }
      if (!trimmed.endsWith(';')) {
        diagnostics.push(
          makeDiagnostic(
            source,
            lineOffset + code.length,
            `Missing semicolon after ${kind} declaration.`,
            'This statement does not end with a semicolon.',
            'Add a semicolon at the end of the declaration.',
            'warning',
            {
              kind: 'replace-line',
              line: index + 1,
              replacement: `${code.trimEnd()};${line.slice(code.length)}`,
            }
          )
        );
      }
      return;
    }
    const assignment = trimmed.match(
      /^([A-Za-z_]\w*)(?:\s*\[\s*\d+\s*\])?\s*=\s*(.*?)\s*;?$/
    );
    if (assignment) {
      const [, target, expression] = assignment;
      const targetOffset = lineOffset + line.indexOf(target);
      if (!expression) {
        diagnostics.push(
          makeDiagnostic(
            source,
            lineOffset + line.indexOf('=') + 1,
            'Missing expression after assignment operator.',
            'An assignment must have an expression on its right-hand side.',
            'Provide a valid logic expression after the equals sign.'
          )
        );
      }
      if (!trimmed.endsWith(';')) {
        diagnostics.push(
          makeDiagnostic(
            source,
            lineOffset + code.length,
            'Missing semicolon after assignment.',
            'This assignment does not end with a semicolon.',
            'Add a semicolon at the end of the assignment.',
            'warning',
            {
              kind: 'replace-line',
              line: index + 1,
              replacement: `${code.trimEnd()};${line.slice(code.length)}`,
            }
          )
        );
      }
      if (!declared.has(target)) {
        diagnostics.push(
          makeDiagnostic(
            source,
            targetOffset,
            `Signal '${target}' is assigned but has not been declared.`,
            `The target signal '${target}' was not declared as an input, output, or wire.`,
            `Declare '${target}' as an output or wire before assigning to it.`,
            'error'
          )
        );
      }
    } else if (/^(input|output|wire)\b/.test(trimmed)) {
      diagnostics.push(
        makeDiagnostic(
          source,
          lineOffset,
          'Invalid signal declaration.',
          'The declaration does not match the expected format.',
          'Use a declaration such as input a; or output y;.'
        )
      );
    }
  });
  // Check references to undeclared signals.
  const cleanSource = source.replace(/\/\/[^\n]*/g, (comment) =>
    ' '.repeat(comment.length)
  );
  const identifierRegex = /\b[A-Za-z_]\w*\b/g;
  const identifiers = [];
  let match;
  while ((match = identifierRegex.exec(cleanSource)) !== null) {
    identifiers.push({
      name: match[0],
      offset: match.index,
    });
  }
  const keywords = new Set([
    'input',
    'output',
    'wire',
    'assign',
    'and',
    'or',
    'not',
    'xor',
    'nand',
    'nor',
    'xnor',
    'buf',
    'dff',
    'wire',
  ]);
  const assignmentTargets = new Set();
  for (const line of lines) {
    const targetMatch = line.match(/^\s*([A-Za-z_]\w*)\s*=/);
    if (targetMatch) assignmentTargets.add(targetMatch[1]);
  }
  const reported = new Set();
  for (const identifier of identifiers) {
    const { name, offset: position } = identifier;
    const lineStart = cleanSource.lastIndexOf('\n', position - 1) + 1;
    const lineEnd = cleanSource.indexOf('\n', position);
    const lineText = cleanSource.slice(
      lineStart,
      lineEnd === -1 ? cleanSource.length : lineEnd
    );
    if (
      keywords.has(name.toLowerCase()) ||
      declared.has(name) ||
      assignmentTargets.has(name) ||
      GATE_NAMES.has(name.toLowerCase()) ||
      /^\s*circuit\s+/i.test(lineText)
    ) {
      continue;
    }
    if (
      /^\s*[A-Za-z_]\w*\s*=/.test(lineText) &&
      lineText.slice(0, lineText.indexOf('=')).trim() === name
    ) {
      continue;
    }
    const key = `${name}:${position}`;
    if (reported.has(key)) continue;
    reported.add(key);
    const nearby = [...declared].find(
      (declaredName) => editDistance(name, declaredName) <= 2
    );
    diagnostics.push(
      makeDiagnostic(
        source,
        position,
        `Undefined signal reference '${name}'.`,
        `The signal '${name}' is used but has not been declared.`,
        nearby
          ? `Did you mean '${nearby}'?`
          : `Declare '${name}' as an input or wire, or correct its name.`
      )
    );
  }
  return diagnostics;
}
export function enrichDiagnostics(diagnostics, source) {
  return diagnostics.map((diagnostic) => {
    const line = Math.max(1, Number(diagnostic.line) || 1);
    const col = Math.max(1, Number(diagnostic.col) || 1);
    return {
      ...diagnostic,
      line,
      col,
      severity: diagnostic.severity || diagnostic.type || 'error',
      explanation:
        diagnostic.explanation ||
        'The compiler detected a problem in this statement.',
      suggestion:
        diagnostic.suggestion || 'Check the syntax and signal declarations.',
    };
  });
}
