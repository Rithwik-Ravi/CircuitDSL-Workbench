export const TOKEN_TYPES = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  SYMBOL: 'SYMBOL',
  EOF: 'EOF',
};

const KEYWORDS = new Set([
  'circuit',
  'module',
  'input',
  'output',
  'wire',
  'Wire',
  'assert',
  'test',
]);

export class Lexer {
  constructor(input) {
    this.input = input || '';
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];
  }

  tokenize() {
    this.tokens = [];
    this.errors = [];
    this.pos = 0;
    this.line = 1;
    this.col = 1;

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Newlines
      if (char === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
        continue;
      }

      // Whitespace
      if (/\s/.test(char)) {
        this.col++;
        this.pos++;
        continue;
      }

      // Single-line comments: // ...
      if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Block comments: /* ... */
      if (char === '/' && this.input[this.pos + 1] === '*') {
        const startLine = this.line;
        const startCol = this.col;
        this.pos += 2;
        this.col += 2;
        let closed = false;
        while (this.pos < this.input.length) {
          if (this.input[this.pos] === '*' && this.input[this.pos + 1] === '/') {
            this.pos += 2;
            this.col += 2;
            closed = true;
            break;
          }
          if (this.input[this.pos] === '\n') {
            this.line++;
            this.col = 1;
            this.pos++;
          } else {
            this.pos++;
            this.col++;
          }
        }
        if (!closed) {
          this.errors.push({
            code: 'E_UNCLOSED_COMMENT',
            severity: 'error',
            type: 'error',
            line: startLine,
            col: startCol,
            endLine: this.line,
            endCol: this.col,
            range: { startLine, startCol, endLine: this.line, endCol: this.col },
            message: 'Lexical Error: Unclosed block comment',
            explanation: 'A block comment was opened with "/*" but was never closed with "*/".',
            suggestion: 'Add "*/" at the end of the comment.',
          });
        }
        continue;
      }

      // Keywords & Identifiers
      if (/[A-Za-z_]/.test(char)) {
        let value = '';
        const startCol = this.col;
        const startLine = this.line;
        while (
          this.pos < this.input.length &&
          /[A-Za-z0-9_]/.test(this.input[this.pos])
        ) {
          value += this.input[this.pos];
          this.pos++;
          this.col++;
        }

        const type = KEYWORDS.has(value)
          ? TOKEN_TYPES.KEYWORD
          : TOKEN_TYPES.IDENTIFIER;

        this.tokens.push({
          type,
          value,
          line: startLine,
          col: startCol,
          endLine: startLine,
          endCol: this.col,
          range: { startLine, startCol, endLine: startLine, endCol: this.col },
        });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char)) {
        let value = '';
        const startCol = this.col;
        const startLine = this.line;
        while (
          this.pos < this.input.length &&
          /[0-9]/.test(this.input[this.pos])
        ) {
          value += this.input[this.pos];
          this.pos++;
          this.col++;
        }
        const numVal = parseInt(value, 10);
        this.tokens.push({
          type: TOKEN_TYPES.NUMBER,
          value: numVal,
          rawValue: value,
          line: startLine,
          col: startCol,
          endLine: startLine,
          endCol: this.col,
          range: { startLine, startCol, endLine: startLine, endCol: this.col },
        });
        continue;
      }

      // Symbols
      if (['{', '}', '(', ')', '[', ']', ':', ';', '=', ','].includes(char)) {
        this.tokens.push({
          type: TOKEN_TYPES.SYMBOL,
          value: char,
          line: this.line,
          col: this.col,
          endLine: this.line,
          endCol: this.col + 1,
          range: { startLine: this.line, startCol: this.col, endLine: this.line, endCol: this.col + 1 },
        });
        this.pos++;
        this.col++;
        continue;
      }

      // Illegal character
      const errLine = this.line;
      const errCol = this.col;
      this.errors.push({
        code: 'E_ILLEGAL_CHAR',
        severity: 'error',
        type: 'error',
        line: errLine,
        col: errCol,
        endLine: errLine,
        endCol: errCol + 1,
        range: { startLine: errLine, startCol: errCol, endLine: errLine, endCol: errCol + 1 },
        message: `Lexical Error: Unexpected illegal character '${char}'`,
        explanation: `The character '${char}' is not recognized in CircuitDSL syntax.`,
        suggestion: `Remove or replace '${char}'.`,
      });
      this.pos++;
      this.col++;
    }

    this.tokens.push({
      type: TOKEN_TYPES.EOF,
      value: null,
      line: this.line,
      col: this.col,
      endLine: this.line,
      endCol: this.col,
      range: { startLine: this.line, startCol: this.col, endLine: this.line, endCol: this.col },
    });

    return { tokens: this.tokens, errors: this.errors };
  }
}
